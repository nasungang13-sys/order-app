import { Router } from 'express'

function toMenu(menu) {
  return {
    id: menu.id,
    name: menu.name,
    description: menu.description,
    price: menu.price,
    imageUrl: menu.image_url,
    ...(menu.stock_quantity === undefined
      ? {}
      : { stockQuantity: menu.stock_quantity }),
    options: menu.options,
  }
}

export function createMenusRouter(pool, { includeStock = false } = {}) {
  const router = Router()

  router.get('/', async (_request, response) => {
    const stockColumn = includeStock ? ', m.stock_quantity' : ''
    const stockFilter = includeStock ? '' : 'WHERE m.stock_quantity > 0'
    const { rows } = await pool.query(
      `SELECT
         m.id, m.name, m.description, m.price, m.image_url${stockColumn},
         COALESCE(
           json_agg(
             json_build_object('id', o.id, 'name', o.name, 'price', o.price)
             ORDER BY o.name
           ) FILTER (WHERE o.id IS NOT NULL),
           '[]'::json
         ) AS options
       FROM menus m
       LEFT JOIN options o ON o.menu_id = m.id
       ${stockFilter}
       GROUP BY m.id
       ORDER BY m.name`,
    )

    response.json({ items: rows.map(toMenu) })
  })

  return router
}
