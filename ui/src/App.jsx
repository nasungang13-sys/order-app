import { useEffect, useState } from 'react'
import AdminDashboard from './AdminDashboard.jsx'
import { createOrder, getMenus } from './api.js'
import './App.css'

const currency = new Intl.NumberFormat('ko-KR')

function formatPrice(price) {
  return `${currency.format(price)}원`
}

function OrderPage() {
  const [menus, setMenus] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState({})
  const [cart, setCart] = useState([])
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    getMenus({ signal: controller.signal })
      .then(({ items }) => setMenus(items))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMenuError(error.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMenuLoading(false)
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  function toggleOption(menuId, optionId) {
    setSelectedOptions((current) => {
      const menuOptions = current[menuId] ?? []
      const nextOptions = menuOptions.includes(optionId)
        ? menuOptions.filter((id) => id !== optionId)
        : [...menuOptions, optionId]

      return { ...current, [menuId]: nextOptions }
    })
  }

  function addToCart(menu) {
    const optionIds = [...(selectedOptions[menu.id] ?? [])].sort()
    const options = menu.options.filter((option) =>
      optionIds.includes(option.id),
    )
    const key = `${menu.id}:${optionIds.join(',')}`
    const unitPrice =
      menu.price + options.reduce((sum, option) => sum + option.price, 0)

    setCart((current) => {
      const existingItem = current.find((item) => item.key === key)

      if (existingItem) {
        return current.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      return [
        ...current,
        {
          key,
          menuId: menu.id,
          name: menu.name,
          options,
          unitPrice,
          quantity: 1,
        },
      ]
    })
    setNotice(`${menu.name} 메뉴를 장바구니에 담았습니다.`)
  }

  function changeCartQuantity(key, adjustment) {
    setCart((current) => current.flatMap((item) => {
      if (item.key !== key) return [item]

      const quantity = item.quantity + adjustment
      return quantity > 0 ? [{ ...item, quantity }] : []
    }))
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )

  async function submitOrder() {
    if (cart.length === 0 || submitting) return

    setSubmitting(true)
    setNotice('')
    try {
      const order = await createOrder(
        cart.map((item) => ({
          menuId: item.menuId,
          quantity: item.quantity,
          optionIds: item.options.map((option) => option.id),
        })),
      )
      setCart([])
      setSelectedOptions({})
      setNotice(`주문이 접수되었습니다. 주문 번호: ${order.id}`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="COZY 홈">
          <span className="brand__mark" aria-hidden="true">
            C
          </span>
          <span>COZY</span>
        </a>
        <nav className="site-nav" aria-label="주요 메뉴">
          <a className="site-nav__link site-nav__link--active" href="/">
            주문하기
          </a>
          <a className="site-nav__link" href="/admin">
            관리자
          </a>
        </nav>
      </header>

      <main className="page-content">
        <section className="menu-section" aria-labelledby="menu-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FRESHLY BREWED FOR YOU</p>
              <h1 id="menu-heading">오늘의 커피</h1>
              <p className="section-description">
                취향에 맞는 커피를 골라 여유로운 한 잔을 즐겨보세요.
              </p>
            </div>
            <span className="menu-count">COFFEE · {menus.length}</span>
          </div>

          {menuLoading ? (
            <div className="request-state" role="status">메뉴를 불러오는 중입니다.</div>
          ) : menuError ? (
            <div className="request-state request-state--error" role="alert">
              <p>{menuError}</p>
              <button
                className="button button--primary"
                onClick={() => {
                  setMenuLoading(true)
                  setMenuError('')
                  setReloadKey((key) => key + 1)
                }}
                type="button"
              >
                다시 시도
              </button>
            </div>
          ) : menus.length === 0 ? (
            <div className="request-state">현재 판매 중인 메뉴가 없습니다.</div>
          ) : (
            <div className="menu-grid">
              {menus.map((menu, index) => {
                const isIced = menu.name.includes('(ICE)')
                const isHot = menu.name.includes('(HOT)')
                const art = isIced ? 'iced' : isHot ? 'hot' : 'latte'
                const icon = isIced ? '🧊' : isHot ? '☕' : '🥛'

                return (
              <article className="menu-card" key={menu.id}>
                <div
                  className={`menu-card__art menu-card__art--${art}`}
                  aria-hidden={!menu.imageUrl}
                >
                  {menu.imageUrl && (
                    <img className="menu-card__image" src={menu.imageUrl} alt={menu.name} />
                  )}
                  <span className="menu-card__art-label">
                    COZY
                    <br />
                    BLEND No.0{index + 1}
                  </span>
                  {!menu.imageUrl && <span className="menu-card__cup">{icon}</span>}
                  <span className="menu-card__art-caption">MADE WITH CARE</span>
                </div>

                <div className="menu-card__body">
                  <div className="menu-card__title-row">
                    <div>
                      <h2>{menu.name}</h2>
                      <p className="menu-card__description">
                        {menu.description}
                      </p>
                    </div>
                    <span className="menu-card__price">
                      {formatPrice(menu.price)}
                    </span>
                  </div>

                  {(menu.options ?? []).length > 0 && (
                    <fieldset className="option-list">
                      <legend>추가 옵션</legend>
                      {menu.options.map((option) => {
                      const inputId = `${menu.id}-${option.id}`

                        return (
                        <label className="option" htmlFor={inputId} key={option.id}>
                          <input
                            aria-label={`${menu.name} ${option.name} ${
                              option.price > 0
                                ? `+${formatPrice(option.price)}`
                                : '+0원'
                            }`}
                            checked={(
                              selectedOptions[menu.id] ?? []
                            ).includes(option.id)}
                            id={inputId}
                            onChange={() =>
                              toggleOption(menu.id, option.id)
                            }
                            type="checkbox"
                          />
                          <span className="option__name">{option.name}</span>
                          <span className="option__price">
                            {option.price > 0
                              ? `+${formatPrice(option.price)}`
                              : '+0원'}
                          </span>
                        </label>
                      )
                      })}
                    </fieldset>
                  )}

                  <button
                    aria-label={`${menu.name} 담기`}
                    className="button button--primary menu-card__add"
                    onClick={() => addToCart(menu)}
                    type="button"
                  >
                    <span aria-hidden="true">＋</span> 담기
                  </button>
                </div>
                </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="cart-section" aria-labelledby="cart-heading">
          <div className="cart-section__header">
            <div className="cart-title">
              <span className="cart-title__icon" aria-hidden="true">
                ▤
              </span>
              <h2 id="cart-heading">장바구니</h2>
              <span className="cart-count">{cartCount}</span>
            </div>
            <span className="cart-section__hint">주문 전 메뉴를 확인해 주세요</span>
          </div>

          <div className="cart-content">
            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <span className="cart-empty__icon" aria-hidden="true">
                    ☕
                  </span>
                  <p>아직 담긴 메뉴가 없어요.</p>
                  <span>마음에 드는 커피를 장바구니에 담아보세요.</span>
                </div>
              ) : (
                <ul className="cart-list">
                  {cart.map((item) => (
                    <li className="cart-item" key={item.key}>
                      <div className="cart-item__details">
                        <span className="cart-item__name">{item.name}</span>
                        {item.options.length > 0 && (
                          <span className="cart-item__options">
                            {item.options.map((option) => option.name).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="cart-item__quantity">
                        <button
                          aria-label={`${item.name} 수량 감소`}
                          disabled={item.quantity === 1}
                          onClick={() => changeCartQuantity(item.key, -1)}
                          type="button"
                        >
                          −
                        </button>
                        <output aria-label={`${item.quantity}개`}>
                          {item.quantity}
                        </output>
                        <button
                          aria-label={`${item.name} 수량 증가`}
                          onClick={() => changeCartQuantity(item.key, 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <span className="cart-item__price">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cart-summary">
              <div className="cart-total">
                <span>총 금액</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>
              <button
                className="button button--primary cart-submit"
                disabled={cart.length === 0 || submitting}
                onClick={submitOrder}
                type="button"
              >
                {submitting ? '주문 접수 중...' : '주문하기'}{' '}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </div>
        </section>

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

function App() {
  return window.location.pathname === '/admin' ? (
    <AdminDashboard />
  ) : (
    <OrderPage />
  )
}

export default App
