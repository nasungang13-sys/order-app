import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createApp } from '../src/app.js'

const menuId = '00000000-0000-4000-8000-000000000001'
const orderId = '00000000-0000-4000-8000-000000000101'
const menu = {
  id: menuId,
  name: '아메리카노 (ICE)',
  description: '산뜻하고 깔끔한 밸런스',
  price: 4000,
  image_url: null,
  stock_quantity: 2,
  options: [{ id: '00000000-0000-4000-8000-000000000011', name: '샷 추가', price: 500 }],
}

let appServer
let baseUrl
let stock
let status
let lastMenuQuery

function createPool() {
  return {
    async query(sql, params = []) {
      if (sql.includes('SELECT 1')) {
        return { rows: [{ '?column?': 1 }] }
      }

      if (sql.includes('FROM menus m')) {
        lastMenuQuery = sql
        const soldOutMenu = sql.includes('WHERE m.stock_quantity > 0') && stock === 0
        const selectedStock = /m\.image_url,\s*m\.stock_quantity/.test(sql)
        const item = selectedStock
          ? { ...menu, stock_quantity: stock }
          : {
              id: menu.id,
              name: menu.name,
              description: menu.description,
              price: menu.price,
              image_url: menu.image_url,
              options: menu.options,
            }
        const items = soldOutMenu ? [] : [item]
        return { rows: items }
      }

      if (sql.includes('UPDATE menus')) {
        const [id, adjustment] = params
        if (id !== menuId || stock + adjustment < 0) {
          return { rows: [] }
        }
        stock += adjustment
        return { rows: [{ id, stock_quantity: stock }] }
      }

      if (sql.includes('SELECT id FROM menus')) {
        return { rows: params[0] === menuId ? [{ id: menuId }] : [] }
      }

      if (sql.includes('SELECT id FROM orders ORDER BY')) {
        return { rows: [{ id: orderId }] }
      }

      if (sql.includes('SELECT id, ordered_at, status, total_amount')) {
        return {
          rows: [
            {
              id: orderId,
              ordered_at: new Date('2026-10-15T00:00:00.000Z'),
              status,
              total_amount: 4500,
            },
          ],
        }
      }

      if (sql.includes('FROM order_items')) {
        return {
          rows: [
            {
              id: '00000000-0000-4000-8000-000000000201',
              order_id: orderId,
              menu_id: menuId,
              menu_name: menu.name,
              quantity: 1,
              unit_price: 4500,
              line_amount: 4500,
            },
          ],
        }
      }

      if (sql.includes('FROM order_item_options')) {
        return { rows: [] }
      }

      if (sql.includes('UPDATE orders')) {
        const [id, nextStatus, expectedStatus] = params
        if (id !== orderId || status !== expectedStatus) {
          return { rows: [] }
        }
        status = nextStatus
        return {
          rows: [{ id, status, updated_at: new Date('2026-10-15T00:01:00.000Z') }],
        }
      }

      if (sql.includes('SELECT status FROM orders')) {
        return { rows: status ? [{ status }] : [] }
      }

      throw new Error(`Unexpected query in test pool: ${sql}`)
    },
  }
}

beforeEach(async () => {
  stock = 2
  status = 'received'
  lastMenuQuery = ''
  appServer = createApp(createPool()).listen(0, '127.0.0.1')
  await new Promise((resolve) => appServer.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${appServer.address().port}`
})

afterEach(async () => {
  await new Promise((resolve, reject) => {
    appServer.close((error) => (error ? reject(error) : resolve()))
  })
})

test('public menu endpoint hides stock and excludes sold-out menus', async () => {
  const response = await fetch(`${baseUrl}/api/menus`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.items.length, 1)
  assert.equal('stockQuantity' in body.items[0], false)
  assert.match(lastMenuQuery, /WHERE m\.stock_quantity > 0/)
})

test('admin stock endpoint increments and prevents negative stock', async () => {
  const increase = await fetch(`${baseUrl}/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjustment: 1 }),
  })
  assert.equal((await increase.json()).stockQuantity, 3)

  const decrease = await fetch(`${baseUrl}/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjustment: -1 }),
  })
  assert.equal((await decrease.json()).stockQuantity, 2)
})

test('stock endpoint rejects adjustment values other than one item', async () => {
  const response = await fetch(`${baseUrl}/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjustment: 2 }),
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'INVALID_REQUEST')
})

test('order status endpoint only allows the next state transition', async () => {
  const response = await fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'preparing' }),
  })

  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'preparing')

  const invalidTransition = await fetch(
    `${baseUrl}/api/admin/orders/${orderId}/status`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'received' }),
    },
  )
  assert.equal(invalidTransition.status, 400)
})

test('order lookup returns saved order details', async () => {
  const response = await fetch(`${baseUrl}/api/orders/${orderId}`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.id, orderId)
  assert.equal(body.items[0].menuName, menu.name)
  assert.equal(body.totalAmount, 4500)
})

test('order lookup rejects malformed IDs', async () => {
  const response = await fetch(`${baseUrl}/api/orders/not-a-uuid`)

  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'INVALID_ID')
})
