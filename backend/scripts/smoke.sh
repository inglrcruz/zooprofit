#!/usr/bin/env bash
# End-to-end check against a running API with an empty database:
#   API=http://localhost:8080 scripts/smoke.sh
set -euo pipefail
API=${API:-http://localhost:8080}
n=0

# req METHOD PATH TOKEN [JSON] → prints "<status> <body>"
req() {
  curl -s -o /tmp/smoke.$$ -w '%{http_code}' -X "$1" "$API$2" \
    -H "Authorization: Bearer $3" -H 'Content-Type: application/json' ${4:+-d "$4"}
  echo " $(cat /tmp/smoke.$$)"; rm -f /tmp/smoke.$$
}
# expect STATUS DESCRIPTION METHOD PATH TOKEN [JSON] → leaves the body in $body
expect() {
  local want=$1 what=$2; shift 2
  local out; out=$(req "$@")
  body=${out#* }
  [[ ${out%% *} == "$want" ]] || { echo "FAIL $what: wanted $want, got $out"; exit 1; }
  n=$((n + 1))
}
field() { python3 -c "import json,sys; print(json.loads(sys.argv[1])$1)" "$body"; }

tag=$RANDOM
expect 201 "register owner" POST /auth/register "" "{\"name\":\"Rafael\",\"email\":\"owner$tag@test.do\",\"password\":\"1234\"}"
OWNER=$(field "['token']")
expect 409 "duplicate account" POST /auth/register "" "{\"name\":\"Otro\",\"email\":\"OWNER$tag@test.do\",\"password\":\"1234\"}"
expect 401 "wrong password" POST /auth/login "" "{\"identifier\":\"owner$tag@test.do\",\"password\":\"0000\"}"
expect 200 "login" POST /auth/login "" "{\"identifier\":\"owner$tag@test.do\",\"password\":\"1234\"}"
expect 400 "password must be 4 digits" POST /auth/register "" "{\"name\":\"X\",\"email\":\"x$tag@test.do\",\"password\":\"secreto1\"}"
expect 400 "change password needs the current one" PATCH /me/password "$OWNER" '{"current":"0000","password":"4321"}'
expect 400 "new password must be 4 digits" PATCH /me/password "$OWNER" '{"current":"1234","password":"43210"}'
expect 204 "change password" PATCH /me/password "$OWNER" '{"current":"1234","password":"4321"}'
expect 401 "old password is gone" POST /auth/login "" "{\"identifier\":\"owner$tag@test.do\",\"password\":\"1234\"}"
expect 200 "new password signs in" POST /auth/login "" "{\"identifier\":\"owner$tag@test.do\",\"password\":\"4321\"}"
expect 401 "no token" GET /farms ""
expect 400 "species/type mismatch" POST /farms "$OWNER" '{"name":"X","species":"aves","type":"reproduccion"}'

expect 201 "create farm" POST /farms "$OWNER" '{"name":"Granja La Loma","species":"cerdos","type":"reproduccion"}'
FARM=$(field "['id']"); F=/farms/$FARM
expect 200 "fixed lots created" GET $F/lots "$OWNER"
[[ $(field "[0]['code']") == Entradas && $(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$body") == 4 ]] || { echo "FAIL fixed lots: $body"; exit 1; }
FIXED=$(field "[0]['id']")
expect 403 "fixed lot cannot be deleted" DELETE $F/lots/$FIXED "$OWNER"
expect 200 "config merges" PATCH $F "$OWNER" '{"config":{"kpiConfig":{"edadDestete":21}}}'
expect 200 "config merges again" PATCH $F "$OWNER" '{"config":{"weekConfig":{"diaInicio":1}}}'
[[ $(field "['config']['kpiConfig']['edadDestete']") == 21 ]] || { echo "FAIL config lost a key: $body"; exit 1; }

expect 201 "create lot A" POST $F/lots "$OWNER" '{"code":"Gestación B-14","fase":"gestacion","entryDate":"2026-10-01"}'
LOTA=$(field "['id']")
expect 201 "create lot B" POST $F/lots "$OWNER" '{"code":"Maternidad M-07"}'
LOTB=$(field "['id']")
expect 400 "bad date rejected" POST $F/lots "$OWNER" '{"code":"X","entryDate":"8 oct"}'

# invitation → worker restricted to lot A
expect 201 "invite" POST $F/invitations "$OWNER" "{\"nombre\":\"Miguel Díaz\",\"rol\":\"auxiliar\",\"lotIds\":[\"$LOTA\"]}"
CODE=$(field "['code']")
expect 200 "preview code" GET /auth/invitations/$CODE ""
[[ $(field "['farmName']") == "Granja La Loma" ]] || { echo "FAIL preview: $body"; exit 1; }
expect 201 "join" POST /auth/join "" "{\"code\":\"$CODE\",\"password\":\"5678\",\"phone\":\"809-555-$(printf %04d $((tag % 10000)))\"}"
WORKER=$(field "['token']"); WORKER_ID=$(field "['user']['id']")
expect 400 "code is single use" POST /auth/join "" "{\"code\":\"$CODE\",\"password\":\"9012\"}"
expect 200 "worker logs in by phone" POST /auth/login "" "{\"identifier\":\"809 555 $(printf %04d $((tag % 10000)))\",\"password\":\"5678\"}"
expect 200 "worker sees the farm" GET /farms "$WORKER"
[[ $(field "[0]['rol']") == auxiliar ]] || { echo "FAIL member role: $body"; exit 1; }
expect 200 "worker sees only lot A" GET $F/lots "$WORKER"
[[ $(field "[0]['id']") == "$LOTA" && $(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$body") == 1 ]] || { echo "FAIL lot restriction: $body"; exit 1; }
expect 404 "worker cannot reach lot B" GET $F/lots/$LOTB/registros "$WORKER"
expect 403 "worker cannot list members" GET $F/members "$WORKER"
expect 403 "worker cannot edit the farm" PATCH $F "$WORKER" '{"name":"Mía"}'

# registros: pending → confirmed
expect 201 "worker records event" POST $F/lots/$LOTA/registros "$WORKER" '{"tipo":"inseminacion","fecha":"2026-10-08","status":"confirmed","cerdaCodigo":"2635","data":{"verraco":"VR-02","hora":"07:30"}}'
REG=$(field "['id']")
[[ $(field "['status']") == pending ]] || { echo "FAIL worker self-confirmed: $body"; exit 1; }
expect 200 "worker edits own pending" PATCH $F/registros/$REG "$WORKER" '{"data":{"tecnico":"Saul"}}'
[[ $(field "['data']['verraco']") == VR-02 && $(field "['lotId']") == "$LOTA" ]] || { echo "FAIL partial update: $body"; exit 1; }
expect 403 "worker cannot confirm" PATCH $F/registros/$REG "$WORKER" '{"status":"confirmed"}'
expect 200 "owner confirms" PATCH $F/registros/$REG "$OWNER" '{"status":"confirmed"}'
[[ $(field "['confirmedBy']") != "" ]] || { echo "FAIL confirmedBy: $body"; exit 1; }
expect 403 "worker cannot touch confirmed" DELETE $F/registros/$REG "$WORKER"
expect 201 "owner records in lot B" POST $F/lots/$LOTB/registros "$OWNER" '{"tipo":"parto","fecha":"2026-10-07"}'
expect 200 "worker lists farm-wide" GET "$F/registros?from=2026-10-01&to=2026-10-31" "$WORKER"
[[ $(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$body") == 1 ]] || { echo "FAIL registros leak across lots: $body"; exit 1; }
expect 200 "date filter" GET "$F/registros?from=2026-10-08" "$OWNER"
[[ $(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$body") == 1 ]] || { echo "FAIL date filter: $body"; exit 1; }

# catalog + stock
expect 201 "create sow" POST $F/cerdas "$OWNER" "{\"arete\":\"2301\",\"estadoActual\":\"gestante\",\"lotIdActual\":\"$LOTA\"}"
SOW=$(field "['id']")
expect 200 "filter sows" GET "$F/cerdas?estado=gestante" "$OWNER"
expect 201 "create product" POST $F/productos "$OWNER" '{"descripcion":"Iniciador cerdos 50 kg","tipo":"Alimento","unidad":"sacos","minimo":10}'
PROD=$(field "['id']")
expect 201 "stock in" POST $F/productos/$PROD/movimientos "$OWNER" '{"cantidad":40,"tipo":"entrada","fecha":"2026-10-06"}'
expect 201 "stock out" POST $F/productos/$PROD/movimientos "$WORKER" "{\"cantidad\":-12,\"tipo\":\"consumo\",\"fecha\":\"2026-10-08\",\"lotId\":\"$LOTA\"}"
expect 200 "stock cannot be edited" PATCH $F/productos/$PROD "$OWNER" '{"existencia":999,"minimo":20}'
[[ $(field "['existencia']") == 28 && $(field "['minimo']") == 20 ]] || { echo "FAIL stock: $body"; exit 1; }

# isolation between farms
expect 201 "register stranger" POST /auth/register "" "{\"name\":\"Ana\",\"email\":\"ana$tag@test.do\",\"password\":\"1234\"}"
ANA=$(field "['token']")
expect 404 "stranger cannot see the farm" GET $F "$ANA"
expect 404 "stranger cannot read sows" GET $F/cerdas/$SOW "$ANA"
expect 201 "stranger's own farm" POST /farms "$ANA" '{"name":"Coop","species":"coopprofit","type":"coopprofit"}'
ANAF=/farms/$(field "['id']")
expect 404 "ids do not cross farms" GET $ANAF/cerdas/$SOW "$ANA"
expect 404 "lots do not cross farms" POST $ANAF/lots/$LOTA/registros "$ANA" '{"tipo":"nota","fecha":"2026-10-08"}'

# cooperative privacy
expect 201 "invite aportante" POST $ANAF/invitations "$ANA" '{"nombre":"María Pérez","rol":"aportante"}'
expect 204 "worker accepts with existing account" POST /invitations/$(field "['code']")/accept "$WORKER"
expect 201 "aportante row (hers)" POST $ANAF/aportantes "$ANA" "{\"nombre\":\"María Pérez\",\"capital\":150000,\"userId\":\"$WORKER_ID\"}"
expect 201 "aportante row (other)" POST $ANAF/aportantes "$ANA" '{"nombre":"Pedro Santana","capital":400000}'
expect 200 "aportante sees only her row" GET $ANAF/aportantes "$WORKER"
[[ $(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$body") == 1 && $(field "[0]['capital']") == 150000 ]] || { echo "FAIL coop privacy: $body"; exit 1; }
expect 403 "aportante is read-only" POST $ANAF/aportantes "$WORKER" '{"nombre":"X"}'

# membership ends at once
expect 204 "owner removes worker" DELETE $F/members/$WORKER_ID "$OWNER"
expect 404 "removed worker is out" GET $F/lots "$WORKER"
expect 204 "delete farm cascades" DELETE $F "$OWNER"
expect 404 "farm is gone" GET $F "$OWNER"

echo "smoke ok ($n checks)"
