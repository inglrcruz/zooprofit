import { Product, ProductMove } from '@/types/data';
import { newId } from '@/utilities/miscellaneous';
import { useGlobalStore } from './global.store';
import { createResourceStore, farmRoute, send } from './resource';

export const useProductStore = createResourceStore<Product>('product', 'productos', undefined, 'producto');
/** Read-only here: movements are created through `moveStock`. */
export const useMoveStore = createResourceStore<ProductMove>('move', 'movimientos', undefined, 'movimiento');

/**
 * Records an entry (positive) or an exit (negative) of stock. The API
 * adjusts the product's `existencia` in the same transaction; here it is
 * adjusted at once so it also shows without a connection.
 *
 * @param product Product moved
 * @param move Signed quantity, kind, date and optional lot / note
 */
export const moveStock = async (product: Product, move: Pick<ProductMove, 'cantidad' | 'tipo' | 'fecha'> & Partial<ProductMove>): Promise<ProductMove> => {
  const global = useGlobalStore.getState();
  try {
    global.setLoading({ move: product.id });
    const item = { ...move, id: newId(), farmId: product.farmId, productId: product.id, createdAt: new Date().toISOString() } as ProductMove;
    useMoveStore.getState().upsert(item);
    useProductStore.getState().upsert({ ...product, existencia: Number(product.existencia) + Number(move.cantidad) });
    await send(
      { id: newId(), store: 'move', method: 'post', route: `${farmRoute()}/productos/${product.id}/movimientos`, body: { ...move, id: item.id }, label: `${product.descripcion}: ${move.cantidad > 0 ? '+' : ''}${move.cantidad}` },
      () => {
        useProductStore.getState().upsert(product);
        useMoveStore.setState({ list: useMoveStore.getState().list.filter((m) => m.id !== item.id) });
      },
    );
    return item;
  } finally {
    global.setLoading({ move: false });
  }
};
