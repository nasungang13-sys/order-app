const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('API 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.')
  }
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `요청에 실패했습니다. (${response.status})`)
  }

  return data
}

export function getMenus({ signal } = {}) {
  return request('/menus', { signal })
}

export function createOrder(items) {
  return request('/orders', { method: 'POST', body: { items } })
}

export function getAdminMenus({ signal } = {}) {
  return request('/admin/menus', { signal })
}

export function getAdminOrders({ signal } = {}) {
  return request('/admin/orders', { signal })
}

export function adjustMenuStock(menuId, adjustment) {
  return request(`/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    body: { adjustment },
  })
}

export function updateOrderStatus(orderId, status) {
  return request(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
  })
}
