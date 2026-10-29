import { useEffect, useState } from 'react'
import {
  adjustMenuStock,
  getAdminMenus,
  getAdminOrders,
  updateOrderStatus,
} from './api.js'
import './AdminDashboard.css'

const currency = new Intl.NumberFormat('ko-KR')
const dateTime = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const statusLabels = {
  received: '주문 접수',
  preparing: '제조 중',
  completed: '제조 완료',
}

function formatPrice(price) {
  return `${currency.format(price)}원`
}

function getMenuIcon(name) {
  if (name.includes('(ICE)')) return '🧊'
  if (name.includes('(HOT)')) return '☕'
  return '🥛'
}

function getInventoryStatus(stock) {
  if (stock === 0) {
    return { label: '품절', className: 'inventory-status--sold-out' }
  }

  if (stock < 5) {
    return { label: '주의', className: 'inventory-status--warning' }
  }

  return { label: '정상', className: 'inventory-status--normal' }
}

function AdminDashboard() {
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingActions, setPendingActions] = useState(() => new Set())
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      getAdminMenus({ signal: controller.signal }),
      getAdminOrders({ signal: controller.signal }),
    ])
      .then(([menuData, orderData]) => {
        setInventory(menuData.items.map((menu) => ({
          ...menu,
          stock: Number(menu.stockQuantity ?? menu.stock_quantity ?? menu.stock ?? 0),
        })))
        setOrders(orderData.items)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(error.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  const summary = [
    {
      label: '총 주문',
      count: orders.length,
      icon: '▤',
      className: 'summary-card--blue',
    },
    {
      label: '주문 접수',
      count: orders.filter((order) => order.status === 'received').length,
      icon: '◷',
      className: 'summary-card--amber',
    },
    {
      label: '제조 중',
      count: orders.filter((order) => order.status === 'preparing').length,
      icon: '☕',
      className: 'summary-card--violet',
    },
    {
      label: '제조 완료',
      count: orders.filter((order) => order.status === 'completed').length,
      icon: '✓',
      className: 'summary-card--green',
    },
  ]

  async function adjustStock(menuId, adjustment) {
    const actionKey = `stock:${menuId}`
    if (pendingActions.has(actionKey)) return
    setPendingActions((current) => new Set(current).add(actionKey))

    try {
      const result = await adjustMenuStock(menuId, adjustment)
      setInventory((current) => current.map((menu) =>
        menu.id === menuId ? { ...menu, stock: result.stockQuantity } : menu,
      ))
      const menu = inventory.find((item) => item.id === menuId)
      setNotice(`${menu.name} 재고를 ${adjustment > 0 ? '1개 늘렸습니다.' : '1개 줄였습니다.'}`)
    } catch (error) {
      setNotice(error.message)
      setLoading(true)
      setReloadKey((key) => key + 1)
    } finally {
      setPendingActions((current) => {
        const next = new Set(current)
        next.delete(actionKey)
        return next
      })
    }
  }

  async function advanceOrder(order) {
    const actionKey = `order:${order.id}`
    if (pendingActions.has(actionKey)) return
    const status = order.status === 'received' ? 'preparing' : 'completed'
    setPendingActions((current) => new Set(current).add(actionKey))

    try {
      const result = await updateOrderStatus(order.id, status)
      setOrders((current) => current.map((item) =>
        item.id === order.id ? { ...item, status: result.status } : item,
      ))
      setNotice(`${order.id.slice(0, 8)} 주문 상태를 '${statusLabels[result.status]}'(으)로 변경했습니다.`)
    } catch (error) {
      setNotice(error.message)
      setLoading(true)
      setReloadKey((key) => key + 1)
    } finally {
      setPendingActions((current) => {
        const next = new Set(current)
        next.delete(actionKey)
        return next
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="COZY 주문 화면">
          <span className="brand__mark" aria-hidden="true">
            C
          </span>
          <span>COZY</span>
        </a>
        <nav className="site-nav" aria-label="주요 메뉴">
          <a className="site-nav__link" href="/">
            주문하기
          </a>
          <a
            aria-current="page"
            className="site-nav__link site-nav__link--active"
            href="/admin"
          >
            관리자
          </a>
        </nav>
      </header>

      <main className="page-content admin-page">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">STORE MANAGEMENT</p>
            <h1>관리자 대시보드</h1>
            <p className="section-description">
              오늘의 주문과 매장 재고를 한눈에 확인하세요.
            </p>
          </div>
          <span className="admin-demo-label">
            <span aria-hidden="true" />
            실시간 데이터
          </span>
        </div>

        {loading ? (
          <div className="request-state" role="status">관리자 데이터를 불러오는 중입니다.</div>
        ) : loadError ? (
          <div className="request-state request-state--error" role="alert">
            <p>{loadError}</p>
            <button
              className="button button--primary"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                setReloadKey((key) => key + 1)
              }}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
        <section className="admin-section" aria-labelledby="summary-heading">
          <div className="admin-section__heading">
            <div>
              <h2 id="summary-heading">주문 요약</h2>
              <p>주문 처리 상태를 확인할 수 있어요.</p>
            </div>
            <span className="admin-section__meta">전체 {orders.length}건</span>
          </div>
          <div className="summary-grid">
            {summary.map((item) => (
              <article
                className={`summary-card ${item.className}`}
                key={item.label}
              >
                <div className="summary-card__top">
                  <span className="summary-card__label">{item.label}</span>
                  <span aria-hidden="true" className="summary-card__icon">
                    {item.icon}
                  </span>
                </div>
                <p className="summary-card__count">
                  {item.count}
                  <span>건</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section" aria-labelledby="inventory-heading">
          <div className="admin-section__heading">
            <div>
              <h2 id="inventory-heading">재고 현황</h2>
              <p>메뉴별 재고를 확인하고 수량을 조정할 수 있어요.</p>
            </div>
            <span className="admin-section__meta">총 {inventory.length}개 메뉴</span>
          </div>
          <div className="inventory-grid">
            {inventory.map((menu) => {
              const status = getInventoryStatus(menu.stock)

              return (
                <article className="inventory-card" key={menu.id}>
                  <div className="inventory-card__top">
                    <span aria-hidden="true" className="inventory-card__icon">
                      {getMenuIcon(menu.name)}
                    </span>
                  </div>
                  <div className="inventory-card__details">
                    <h3>{menu.name}</h3>
                    <span
                      aria-label={`${menu.name} 현재 재고 ${menu.stock}개`}
                      className="inventory-card__quantity"
                    >
                      {menu.stock}<span>개</span>
                    </span>
                    <span
                      className={`inventory-status ${status.className}`}
                    >
                      <span aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>
                  <div className="inventory-card__controls">
                    <div className="stock-buttons">
                      <button
                        aria-label={`${menu.name} 재고 감소`}
                        className="stock-button"
                        disabled={menu.stock === 0 || pendingActions.has(`stock:${menu.id}`)}
                        onClick={() => adjustStock(menu.id, -1)}
                        type="button"
                      >
                        −
                      </button>
                      <button
                        aria-label={`${menu.name} 재고 증가`}
                        className="stock-button stock-button--increase"
                        disabled={pendingActions.has(`stock:${menu.id}`)}
                        onClick={() => adjustStock(menu.id, 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="admin-section orders-section" aria-labelledby="orders-heading">
          <div className="admin-section__heading">
            <div>
              <h2 id="orders-heading">주문 현황</h2>
              <p>접수된 주문을 확인하고 제조를 시작하세요.</p>
            </div>
            <span className="admin-section__meta">
              접수 대기{' '}
              {orders.filter((order) => order.status === 'received').length}건
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="orders-empty">
              <span aria-hidden="true">☕</span>
              <p>아직 접수된 주문이 없습니다.</p>
              <span>새 주문이 들어오면 이곳에 표시됩니다.</span>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card__header">
                    <div className="order-card__identity">
                      <span className="order-card__id">{order.id.slice(0, 8).toUpperCase()}</span>
                      <time className="order-card__time" dateTime={order.orderedAt}>
                        {dateTime.format(new Date(order.orderedAt))}
                      </time>
                    </div>
                    <span
                      className={`order-status order-status--${order.status}`}
                    >
                      <span aria-hidden="true" />
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <div className="order-card__content">
                    <ul className="order-items">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.menuName}`}>
                          <span className="order-item__name">{item.menuName}</span>
                          {item.options.length > 0 && (
                            <span className="order-item__options">
                              {item.options.map((option) => option.name).join(', ')}
                            </span>
                          )}
                          <span className="order-item__quantity">
                            × {item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="order-card__total">
                      <span>주문 금액</span>
                      <strong>{formatPrice(order.totalAmount)}</strong>
                    </div>
                    <div className="order-card__action">
                      {order.status === 'received' || order.status === 'preparing' ? (
                        <button
                          className="button button--primary order-start-button"
                          disabled={pendingActions.has(`order:${order.id}`)}
                          onClick={() => advanceOrder(order)}
                          type="button"
                        >
                          {pendingActions.has(`order:${order.id}`)
                            ? '저장 중...'
                            : order.status === 'received'
                              ? '제조 시작'
                              : '완료'}
                          {!pendingActions.has(`order:${order.id}`) && (
                            <span aria-hidden="true">→</span>
                          )}
                        </button>
                      ) : (
                        <span className="order-card__action-note">
                          {order.status === 'preparing'
                            ? '제조를 진행하고 있어요'
                            : '처리가 완료된 주문입니다'}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
          </>
        )}

        <p aria-live="polite" className="status-message" role="status">
          {notice}
        </p>
      </main>

      <footer className="site-footer">
        <span>COZY COFFEE</span>
        <span>TAKE A MOMENT, TAKE A SIP.</span>
      </footer>
    </div>
  )
}

export default AdminDashboard
