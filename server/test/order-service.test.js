import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOrder } from '../src/order-service.js'

const menuId = '00000000-0000-4000-8000-000000000001'
const secondMenuId = '00000000-0000-4000-8000-000000000002'
const shotId = '00000000-0000-4000-8000-000000000011'
const hotMenuId = '00000000-0000-4000-8000-000000000012'
const orderId = '00000000-0000-4000-8000-000000000101'

function createTransactionPool({ stock = 2 } = {}) {
  const menus = [
    {
      id: menuId,
      name: '아메리카노 (ICE)',
      price: 4000,
      stock_quantity: stock,
    },
    {
      id: secondMenuId,
      name: '아메리카노 (HOT)',
      price: 4000,
      stock_quantity: 5,
    },
  ]
  const options = [
    { id: shotId, menu_id: menuId, name: '샷 추가', price: 500 },
    { id: hotMenuId, menu_id: secondMenuId, name: '샷 추가', price: 500 },
  ]
  const orders = []
  const items = []
  const itemOptions = []

  const client = {
    async query(sql, params = []) {
      if (sql === 'BEGIN') {
        return { rows: [] }
      }
      if (sql === 'COMMIT') {
        return { rows: [] }
      }
      if (sql === 'ROLLBACK') {
        return { rows: [] }
      }
      if (sql.includes('FROM menus') && sql.includes('FOR UPDATE')) {
        return {
          rows: menus.filter((menu) => params[0].includes(menu.id)),
        }
      }
      if (sql.includes('FROM options')) {
        return {
          rows: options.filter((option) => params[0].includes(option.id)),
        }
      }
      if (sql.includes('INSERT INTO orders')) {
        const order = {
          id: orderId,
          ordered_at: new Date('2026-10-15T01:30:00.000Z'),
          status: 'received',
          total_amount: params[0],
        }
        orders.push(order)
        return { rows: [{ id: order.id }] }
      }
      if (sql.includes('INSERT INTO order_items')) {
        const item = {
          id: `00000000-0000-4000-8000-${String(items.length + 201).padStart(12, '0')}`,
          order_id: params[0],
          menu_id: params[1],
          menu_name: params[2],
          menu_price: params[3],
          quantity: params[4],
          unit_price: params[5],
          line_amount: params[6],
        }
        items.push(item)
        return { rows: [{ id: item.id }] }
      }
      if (sql.includes('INSERT INTO order_item_options')) {
        itemOptions.push({
          id: `00000000-0000-4000-8000-${String(itemOptions.length + 301).padStart(12, '0')}`,
          order_item_id: params[0],
          option_id: params[1],
          option_name: params[2],
          option_price: params[3],
        })
        return { rows: [] }
      }
      if (sql.includes('UPDATE menus')) {
        const menu = menus.find((entry) => entry.id === params[0])
        menu.stock_quantity -= params[1]
        return { rows: [] }
      }
      if (sql.includes('SELECT id, ordered_at, status, total_amount')) {
        return { rows: orders.filter((order) => params[0].includes(order.id)) }
      }
      if (sql.includes('FROM order_items')) {
        return { rows: items.filter((item) => params[0].includes(item.order_id)) }
      }
      if (sql.includes('FROM order_item_options')) {
        return {
          rows: itemOptions.filter((option) => params[0].includes(option.order_item_id)),
        }
      }
      throw new Error(`Unexpected transaction query: ${sql}`)
    },
    release() {},
  }

  return {
    menus,
    orders,
    items,
    itemOptions,
    pool: { connect: async () => client },
  }
}

test('creates order from current prices and deducts stock atomically', async () => {
  const database = createTransactionPool({ stock: 2 })
  const order = await createOrder(database.pool, {
    items: [
      { menuId, quantity: 1, optionIds: [shotId] },
      { menuId: secondMenuId, quantity: 2, optionIds: [] },
    ],
  })

  assert.equal(order.status, 'received')
  assert.equal(order.totalAmount, 12500)
  assert.deepEqual(
    order.items.map((item) => [item.menuName, item.quantity, item.lineAmount]),
    [
      ['아메리카노 (ICE)', 1, 4500],
      ['아메리카노 (HOT)', 2, 8000],
    ],
  )
  assert.equal(database.menus[0].stock_quantity, 1)
  assert.equal(database.menus[1].stock_quantity, 3)
  assert.equal(database.orders.length, 1)
  assert.equal(database.itemOptions[0].option_name, '샷 추가')
})

test('rejects insufficient stock without persisting an order or changing stock', async () => {
  const database = createTransactionPool({ stock: 2 })

  await assert.rejects(
    createOrder(database.pool, {
      items: [
        { menuId, quantity: 2, optionIds: [] },
        { menuId, quantity: 1, optionIds: [] },
      ],
    }),
    (error) => error.code === 'INSUFFICIENT_STOCK' && error.status === 409,
  )

  assert.equal(database.menus[0].stock_quantity, 2)
  assert.equal(database.orders.length, 0)
  assert.equal(database.items.length, 0)
})

test('rejects options that belong to a different menu', async () => {
  const database = createTransactionPool()

  await assert.rejects(
    createOrder(database.pool, {
      items: [{ menuId, quantity: 1, optionIds: [hotMenuId] }],
    }),
    (error) => error.code === 'INVALID_OPTION' && error.status === 400,
  )

  assert.equal(database.orders.length, 0)
})
