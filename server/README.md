# COZY 백엔드

Express와 PostgreSQL로 구성한 COZY 커피 주문 앱 API입니다.

## 요구 사항

- Node.js 20 이상
- PostgreSQL 13 이상

## 시작하기

1. PostgreSQL에 `cozy` 데이터베이스를 생성합니다.
2. `server/.env` 파일에서 데이터베이스 연결 정보를 설정합니다.
3. 다음 명령으로 의존성을 설치하고 스키마 및 초기 데이터를 준비합니다.

   ```bash
   npm install
   npm run db:setup
   ```

4. 개발 서버를 시작합니다.

   ```bash
   npm run dev
   ```

기본 주소는 `http://localhost:3000`이며 `GET /api/health`로 연결 상태를 확인할 수 있습니다. Vite 개발 서버 기본 출처 `http://localhost:5173`은 기본 허용 목록에 포함됩니다. 다른 출처를 쓸 때는 `CLIENT_ORIGIN`에 쉼표로 구분해 지정합니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/menus` | 재고를 노출하지 않는 판매 메뉴·옵션 목록 |
| GET | `/api/admin/menus` | 관리자용 메뉴·재고·옵션 목록 |
| PATCH | `/api/admin/menus/:menuId/stock` | 재고 1개 증감 (`{ "adjustment": 1 }` 또는 `-1`) |
| POST | `/api/orders` | 서버 가격 검증, 주문 생성 및 재고 차감 |
| GET | `/api/orders/:orderId` | 주문 단건 조회 |
| GET | `/api/admin/orders` | 관리자 주문 목록 조회 |
| PATCH | `/api/admin/orders/:orderId/status` | 주문 상태 변경 (`preparing` 또는 `completed`) |

주문 및 재고 변경은 PostgreSQL 트랜잭션으로 처리합니다. 모든 오류는 `{ "error": { "code": "...", "message": "..." } }` 형식으로 반환합니다.

## 검증

```bash
npm test
```
