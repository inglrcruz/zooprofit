#!/usr/bin/env python3
"""Turns the Firestore export of PigProfit into SQL for the ZooProfit schema.

    python3 scripts/firestore2sql.py ~/Desktop/PigProfit/firestore-export --password '1234' > import.sql
    mysql -h127.0.0.1 -P3310 -uzooprofit -p zooprofit < import.sql

Run the API once first so the tables exist. The file is one transaction: it
loads completely or not at all, and loading it twice fails on the first
duplicate id instead of duplicating data.

Firestore does not hold passwords, so every imported account gets the one
given with --password (omit it to import the accounts locked).
"""
import argparse, json, os, re, sys, uuid
from datetime import datetime, timezone

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('export_dir')
ap.add_argument('--password', help='temporary password for every imported account')
args = ap.parse_args()

skipped = {}  # reason → count, reported at the end


def skip(reason, n=1):
    skipped[reason] = skipped.get(reason, 0) + n


def load(*path):
    """A collection as {doc id: doc}; {} when the export does not have it."""
    p = os.path.join(args.export_dir, *path, '_collection.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def ts(v):
    """Firestore timestamps come as epoch ms, ISO strings or {__type__, value}."""
    if isinstance(v, dict):
        v = v.get('value')
    if isinstance(v, (int, float)):
        d = datetime.fromtimestamp(v / 1000, timezone.utc)
    elif isinstance(v, str):
        d = datetime.fromisoformat(v.replace('Z', '+00:00')).astimezone(timezone.utc)
    else:
        return None
    return d.strftime('%Y-%m-%d %H:%M:%S.') + '%03d' % (d.microsecond // 1000)


DATE = re.compile(r'^\d{4}-\d\d-\d\d$')


def date(v):
    return v if isinstance(v, str) and DATE.match(v) else ''


# Documents that never stored a creation time get the moment of the export.
EXPORTED_AT = ts(os.path.getmtime(args.export_dir) * 1000)


def stamps(doc):
    created = ts(doc.get('createdAt')) or ts(doc.get('updatedAt')) or EXPORTED_AT
    return {'created_at': created, 'updated_at': ts(doc.get('updatedAt')) or created}


def rest(doc, used):
    """What the columns did not take, kept as JSON so nothing is lost."""
    out = {k: v for k, v in doc.items() if k not in used and k not in ('createdAt', 'updatedAt', 'farmId') and v is not None}
    for k, v in out.items():
        if isinstance(v, dict) and v.get('__type__') == 'timestamp':
            out[k] = v['value']
    return out


ESC = {'\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', '\0': '\\0', '\x1a': '\\Z'}


def lit(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + ''.join(ESC.get(c, c) for c in v) + "'"


def emit(table, rows):
    print(f'-- {table}: {len(rows)}', file=sys.stderr)
    if not rows:
        return
    cols = list(rows[0])
    for i in range(0, len(rows), 500):
        print(f"INSERT INTO `{table}` ({', '.join('`%s`' % c for c in cols)}) VALUES")
        print(',\n'.join('(' + ', '.join(lit(r[c]) for c in cols) + ')' for r in rows[i:i + 500]) + ';')


# ───── users ─────

password_hash = '!'  # matches no password: the account is locked
if args.password:
    import bcrypt
    password_hash = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt(10)).decode()

farms = load('farms')
users, by_email = {}, {}


def add_user(uid, name, email=None, phone=None, doc={}):
    users[uid] = {'id': uid, 'name': name[:120], 'email': email, 'phone': phone, 'password_hash': password_hash,
                  'push_token': doc.get('pushToken', ''), **stamps(doc)}
    if email:
        by_email[email] = uid


for uid, u in load('users').items():
    email = u.get('email', '').strip().lower() or None
    add_user(uid, u.get('nombre') or (email or uid).split('@')[0], email, doc=u)

members = []
for fid, f in farms.items():
    if f['ownerId'] not in users:
        # The owner never got a users document: the farm is kept, but nobody
        # can sign in as its owner until it is given an e-mail or phone.
        add_user(f['ownerId'], 'Propietario (sin datos)')
        skip(f'owner of farm "{f["name"]}" ({fid}) has no e-mail in the export: imported without a login')
    for m in f.get('members', []):
        email = m.get('email', '').strip().lower()
        if email not in by_email:
            # Accounts that signed in with a phone were "<digits>@pigprofit.app".
            phone = re.fullmatch(r'(\d{7,15})@pigprofit\.app', email)
            if not phone:
                skip(f'member {email!r} of farm "{f["name"]}" matches no user')
                continue
            add_user(str(uuid.uuid5(uuid.NAMESPACE_URL, email)), m.get('nombre') or phone[1], phone=phone[1])
            by_email[email] = str(uuid.uuid5(uuid.NAMESPACE_URL, email))
        if by_email[email] == f['ownerId']:
            continue
        members.append({'farm_id': fid, 'user_id': by_email[email], 'rol': m.get('rol') or 'auxiliar',
                        'allowed_lot_ids': m.get('allowedLotIds') or [], 'added_at': ts(m.get('addedAt')) or EXPORTED_AT})

# ───── farms ─────

farm_rows = []
for fid, f in farms.items():
    config = {k: f[k] for k in ('kpiConfig', 'weekConfig') if f.get(k)}
    catalogos = load('farms', fid, 'catalogos')
    if catalogos:
        config['catalogos'] = catalogos
    farm_rows.append({'id': fid, 'name': f['name'], 'species': f['species'], 'type': f['type'],
                      'owner_id': f['ownerId'], 'config': config, **stamps(f)})

invitations = []
for iid, i in load('invitations').items():
    if i['farmId'] not in farms:
        skip('invitations of farms that no longer exist')
        continue
    invitations.append({'id': iid, 'farm_id': i['farmId'], 'code': i['code'], 'nombre': i.get('nombre', ''),
                        'rol': i.get('rol', 'auxiliar'), 'lot_ids': i.get('lotIds') or [], 'telefono': i.get('telefono', ''),
                        'expires_at': ts(i['expiresAt']), 'usado': bool(i.get('usado')), 'usuario_id': i.get('usuarioId'),
                        'usado_at': ts(i.get('usadoAt')), 'created_at': ts(i['createdAt'])})

# ───── lots and their registros ─────

LOT_COLS = ('code', 'codeInterno', 'esFijo', 'nave', 'faseActual', 'subLabel', 'archivado', 'sortOrder', 'parentLotId',
            'origenLotId', 'entryDate', 'birthDate', 'fechaNacimiento', 'fechaInicio', 'fechaFin', 'fechaCierre',
            'initialAnimals', 'initialBirds', 'animalesActivos', 'activeBirds', 'entryWeight')
REG_COLS = ('tipo', 'fecha', 'status', 'cerdaCodigo', 'nota', 'creadoPor', 'confirmedAt')

lots, lot_rows, registros = load('lots'), [], []
for lid, l in lots.items():
    fid = l.get('farmId')
    if fid not in farms:
        skip('lots of farms that no longer exist')
        skip('registros of those lots', len(load('lots', lid, 'registros')))
        continue
    lot_rows.append({
        'id': lid, 'farm_id': fid, 'code': l.get('code', ''), 'code_interno': l.get('codeInterno', ''),
        'es_fijo': bool(l.get('esFijo')), 'nave': l.get('nave', ''), 'fase': l.get('faseActual', ''),
        'sub_label': l.get('subLabel', ''), 'archivado': bool(l.get('archivado')), 'sort_order': l.get('sortOrder', 0),
        'parent_lot_id': l.get('parentLotId') or '', 'origen_lot_id': l.get('origenLotId') or '',
        'entry_date': date(l.get('entryDate')), 'birth_date': date(l.get('birthDate') or l.get('fechaNacimiento')),
        'fecha_inicio': date(l.get('fechaInicio')), 'fecha_fin': date(l.get('fechaFin')), 'fecha_cierre': date(l.get('fechaCierre')),
        # Hens were counted in *Birds, pigs in *Animals; a lot only ever uses one pair.
        'initial_animals': l.get('initialAnimals') or l.get('initialBirds') or 0,
        'active_animals': l.get('animalesActivos') or l.get('activeBirds') or 0,
        'entry_weight': l.get('entryWeight') or 0, 'data': rest(l, LOT_COLS), **stamps(l)})
    for rid, r in load('lots', lid, 'registros').items():
        data = rest(r, REG_COLS)
        author = by_email.get(r.get('creadoPor') or '', '')
        if not author and r.get('creadoPor'):
            data['creadoPor'] = r['creadoPor']  # "importacion", "sistema"…
        confirmed = r.get('status') == 'confirmed'
        registros.append({
            'id': rid, 'farm_id': fid, 'lot_id': lid, 'tipo': r['tipo'], 'fecha': r['fecha'],
            'status': 'confirmed' if confirmed else 'pending', 'sow_id': '', 'cerda_codigo': r.get('cerdaCodigo', ''),
            'nota': r.get('nota', ''), 'data': data, 'creado_por': author, 'confirmed_by': '',
            'confirmed_at': (ts(r.get('confirmedAt')) or ts(r.get('createdAt'))) if confirmed else None, **stamps(r)})

# ───── what hangs from each farm ─────

SOW_COLS = ('arete', 'tipo', 'genetica', 'estadoActual', 'lotIdActual', 'lotOrigenId', 'fechaEntrada', 'fechaUltimoParto',
            'partosHistoricos', 'numRepeticiones', 'motivoSalida', 'codigosAnteriores')
CORRAL_COLS = ('naveId', 'numero', 'largo', 'ancho', 'animalesActivos', 'lotId', '_deleted')

sows, naves, corrales, products, conteos = [], [], [], [], []
for fid in farms:
    for sid, s in load('farms', fid, 'sows').items():
        sows.append({
            'id': sid, 'farm_id': fid, 'arete': s['arete'], 'tipo': s.get('tipo', ''), 'genetica': s.get('genetica', ''),
            'estado_actual': s.get('estadoActual', ''), 'lot_id_actual': s.get('lotIdActual') or '',
            'lot_origen_id': s.get('lotOrigenId') or '', 'fecha_entrada': date(s.get('fechaEntrada')), 'fecha_nacimiento': '',
            'fecha_ultimo_parto': date(s.get('fechaUltimoParto')), 'partos_historicos': s.get('partosHistoricos', 0),
            'num_repeticiones': s.get('numRepeticiones', 0), 'motivo_salida': s.get('motivoSalida') or '',
            'codigos_anteriores': s.get('codigosAnteriores') or [], 'data': rest(s, SOW_COLS), **stamps(s)})
    nave_docs = load('farms', fid, 'naves')
    for nid, n in nave_docs.items():
        naves.append({'id': nid, 'farm_id': fid, 'nombre': n['nombre'], 'tipo': n.get('tipo', ''), 'orden': n.get('orden', 0),
                      'layout': json.loads(n['layoutGrid']) if n.get('layoutGrid') else None, **stamps(n)})
    for cid, c in load('farms', fid, 'corrales').items():
        if c.get('_deleted') or c.get('naveId') not in nave_docs:
            skip('corrales deleted in the app or without a nave')
            continue
        corrales.append({'id': cid, 'farm_id': fid, 'nave_id': c['naveId'], 'numero': str(c.get('numero', '')),
                         'largo': c.get('largo', 0), 'ancho': c.get('ancho', 0), 'capacidad': 0,
                         'animales_activos': c.get('animalesActivos', 0), 'lot_id': c.get('lotId') or '',
                         'data': rest(c, CORRAL_COLS), **stamps(c)})
    for pid, p in load('farms', fid, 'productos').items():
        products.append({'id': pid, 'farm_id': fid, 'codigo': str(p.get('codigo', '')), 'descripcion': p.get('descripcion', ''),
                         'tipo': '', 'unidad': p.get('unidad', ''), 'minimo': 0, 'costo': p.get('costo', 0),
                         'existencia': p.get('existencia', 0), **stamps(p)})
    for cid, c in load('farms', fid, 'conteos').items():
        conteos.append({'id': cid, 'farm_id': fid, 'fecha': c['fecha'], 'status': c.get('status', 'abierto'),
                        'items': c.get('items') or {}, **stamps(c)})

# ───── output, parents before children ─────

print('SET NAMES utf8mb4;\nSTART TRANSACTION;')
emit('users', list(users.values()))
emit('farms', farm_rows)
emit('farm_members', members)
emit('invitations', invitations)
emit('lots', lot_rows)
emit('registros', registros)
emit('sows', sows)
emit('naves', naves)
emit('corrals', corrales)
emit('products', products)
emit('conteos', conteos)
print('COMMIT;')

for reason, n in skipped.items():
    print(f'-- skipped {n}: {reason}', file=sys.stderr)
