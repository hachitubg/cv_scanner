# CV Scanner - Tài liệu dự án

## 1. Tổng quan

CV Scanner là ứng dụng web nội bộ hỗ trợ xử lý quy trình nhận CV trong từng workspace tuyển dụng:

- scan CV từ nhiều định dạng file;
- OCR cho ảnh và PDF scan;
- AI enrich bằng Gemini;
- quản lý ứng viên theo pipeline;
- tách rõ quyền vận hành của HR và quyền đánh giá của manager;
- tách riêng khu admin toàn hệ thống khỏi workspace.

Thay đổi quan trọng nhất ở phiên bản hiện tại:

- bỏ cách hiểu sai giữa `ADMIN` toàn hệ thống và admin trong workspace;
- chuyển workspace role thành `HR_ADMIN`, `HR`, `MANAGER`;
- gỡ menu admin khỏi workspace;
- thêm khu `/admin` riêng bằng `react-admin` cho system admin.

## 2. Tech stack

| Layer | Công nghệ | Ghi chú |
| --- | --- | --- |
| Frontend + Backend | Next.js 16 App Router | Fullstack trong cùng project |
| UI workspace | React 19 + Tailwind CSS | Candidate, dashboard, workspace UX |
| UI system admin | `react-admin` + MUI | CRUD và dashboard monitor cho admin toàn hệ thống |
| ORM | Prisma | Truy cập DB type-safe |
| Database | SQLite | Phù hợp môi trường nội bộ/demo |
| Auth | NextAuth credentials | Session dựa trên JWT |
| Validation | Zod | Validate payload API |
| Parse file | `pdf-parse`, `mammoth` | PDF, DOCX |
| OCR | `tesseract.js`, `pdfjs-dist`, `@napi-rs/canvas` | Ảnh và PDF scan |
| AI scan | Gemini API | API key nhập từ client |

## 3. Cấu trúc thư mục chính

```text
CV_SCANNER/
|-- app/
|   |-- (auth)/
|   |   |-- login/
|   |   `-- register/
|   |-- (app)/
|   |   |-- workspaces/
|   |   `-- workspace/[workspaceId]/
|   |       |-- dashboard/
|   |       |-- members/
|   |       |-- projects/
|   |       `-- candidates/
|   |-- admin/
|   `-- api/
|       |-- auth/
|       |-- scan/
|       |-- gemini/models/
|       |-- candidates/
|       |-- workspaces/
|       `-- admin/
|           |-- monitor/
|           `-- resources/[resource]/
|-- components/
|   |-- admin/
|   |-- auth/
|   |-- candidates/
|   |-- dashboard/
|   |-- layout/
|   `-- workspace/
|-- lib/
|   |-- ai/
|   |-- parser/
|   |-- auth.ts
|   |-- files.ts
|   |-- permissions.ts
|   |-- prisma.ts
|   |-- system-admin.ts
|   `-- utils.ts
|-- prisma/
|   |-- schema.prisma
|   |-- setup.ts
|   `-- seed.ts
`-- types/
    `-- index.ts
```

## 4. Mô hình dữ liệu và quyền

### 4.1 User

- `User.role` chỉ có 2 giá trị: `ADMIN` hoặc `USER`.
- `ADMIN` có phạm vi toàn hệ thống.
- `USER` không mặc định có quyền quản lý workspace nếu không có membership phù hợp.

### 4.2 Workspace và membership

`WorkspaceMember.role` hiện có 3 giá trị:

- `HR_ADMIN`
- `HR`
- `MANAGER`

Ý nghĩa:

- `HR_ADMIN`: full quyền bên trong workspace.
- `HR`: vận hành nghiệp vụ HR, upload CV, cập nhật candidate do mình phụ trách.
- `MANAGER`: đọc CV, review, và chốt các trạng thái cuối của nhân sự.

Quan trọng:

- `HR_ADMIN` không cần màn hình admin riêng.
- Phân quyền workspace được xử lý ngay trong UI workspace.
- `ADMIN` toàn hệ thống được tách thành route `/admin`.

### 4.3 Candidate

Model `Candidate` gồm 2 nhóm field chính:

#### Nhóm dữ liệu vận hành HR

- thông tin cá nhân;
- thông tin liên hệ;
- project;
- HR phụ trách;
- salary/nội dung HR;
- pipeline status;
- status history.

#### Nhóm review của manager

- `managerDecision`
- `managerOfferSalary`
- `managerReviewNote`
- `managerReviewedAt`
- `managerReviewedById`

Manager review được tách riêng để không trộn luồng data entry của HR với luồng đánh giá/chốt nhân sự.

## 5. Role matrix hiện tại trong code

### 5.1 Role toàn hệ thống

| Hành động | ADMIN | USER |
| --- | --- | --- |
| Xem toàn bộ data | Có | Không |
| Truy cập `/admin` | Có | Không |
| Monitor uploads / SQLite / disk | Có | Không |
| CRUD users/workspaces/candidates/projects/files trên toàn hệ thống | Có | Không |

### 5.2 Role trong workspace

| Hành động | HR_ADMIN | HR | MANAGER |
| --- | --- | --- | --- |
| Xem workspace/dashboard/candidates | Có | Có | Có |
| Upload CV | Có | Có | Không |
| Tạo candidate | Có | Có | Không |
| Sửa candidate bất kỳ trong workspace | Có | Không | Không |
| Sửa candidate được giao cho mình | Có | Có | Không |
| Đổi trạng thái vận hành của HR | Có | Có | Không |
| Quản lý members | Có | Không | Không |
| Quản lý projects | Có | Không | Không |
| Xóa candidate | Có | Không | Không |
| Ghi manager review | Có | Không | Có |
| Chốt status cuối `OFFERED`, `OFFER_DECLINED`, `ONBOARDED`, `REJECTED` | Có | Không | Có |

Ghi chú:

- `ADMIN` toàn hệ thống khi đi vào workspace được map như `HR_ADMIN` để không bị chặn bởi permission layer.
- `HR` chỉ được assign candidate cho chính mình.
- `MANAGER` không được upload CV và không được sửa field HR.

## 6. Permission layer trong code

File trung tâm: `lib/permissions.ts`

Helper chính:

- `requireWorkspaceAccess()`
- `requireWorkspaceHrActor()`
- `requireWorkspaceHrAdmin()`
- `canEditWorkspaceCandidate()`
- `canAssignCandidateToHr()`
- `canManagerUpdateCandidateStatus()`

Rule quan trọng:

- `requireWorkspaceHrActor()` cho phép `HR_ADMIN` và `HR`, không cho `MANAGER`.
- `requireWorkspaceHrAdmin()` chỉ cho `HR_ADMIN` hoặc `ADMIN`.
- `canManagerUpdateCandidateStatus()` giới hạn manager vào các status:
  - `OFFERED`
  - `OFFER_DECLINED`
  - `ONBOARDED`
  - `REJECTED`

## 7. Candidate flow

### 7.1 Upload và scan

Route `/workspace/[workspaceId]/candidates/upload` chỉ cho:

- `HR_ADMIN`
- `HR`

Luồng xử lý:

1. Chọn file CV.
2. Parse theo file type.
3. OCR nếu là ảnh/PDF scan.
4. Nếu chọn AI thì gọi Gemini để enrich kết quả.
5. Đổ form candidate.
6. Lưu candidate và file upload.

### 7.2 Candidate list

Tại `/workspace/[workspaceId]/candidates`:

- `HR_ADMIN`: có thể sửa nhanh và review.
- `HR`: chỉ sửa nhanh các candidate đang được giao cho mình.
- `MANAGER`: thấy candidate list ở chế độ review, không thấy upload CTA.

### 7.3 Candidate detail

Tại `/workspace/[workspaceId]/candidates/[candidateId]`:

- `HR_ADMIN`: sửa full data + có thể review.
- `HR`: sửa data nếu đang là người phụ trách.
- `MANAGER`: tập trung vào khối review, được ghi đánh giá và chốt final status.

## 8. Workspace UX

Sidebar workspace đã được dọn lại:

- luôn có `Dashboard`
- luôn có `Kho CV`
- `Upload CV` chỉ hiện cho `HR_ADMIN` và `HR`
- `Dự án` chỉ hiện cho `HR_ADMIN`
- `Thành viên` chỉ hiện cho `HR_ADMIN`
- không còn menu admin trong workspace

Điều này phân tách rõ:

- admin tổng hệ thống: vào `/admin`
- admin trong workspace: là `HR_ADMIN`, thao tác ngay tại workspace

## 9. System admin

### 9.1 Route

- `GET /admin`

### 9.2 Thư viện

- `react-admin`
- `@mui/material`
- `@mui/icons-material`
- `@emotion/react`
- `@emotion/styled`

### 9.3 Monitor dashboard

Dashboard system admin hiển thị:

- tổng users
- tổng workspaces
- tổng candidates
- tổng projects
- tổng files
- tổng dung lượng `public/uploads`
- kích thước `prisma/dev.db`
- disk used/free/total
- top workspaces theo dung lượng file CV
- phân bố status ứng viên
- recent uploads

### 9.4 Resource admin APIs

- `GET /api/admin/monitor`
- `GET /api/admin/resources/users`
- `POST /api/admin/resources/users`
- `GET /api/admin/resources/users/[id]`
- `PATCH /api/admin/resources/users/[id]`
- `DELETE /api/admin/resources/users/[id]`
- `GET /api/admin/resources/workspaces`
- `GET /api/admin/resources/workspaces/[id]`
- `PATCH /api/admin/resources/workspaces/[id]`
- `DELETE /api/admin/resources/workspaces/[id]`
- `GET /api/admin/resources/candidates`
- `GET /api/admin/resources/candidates/[id]`
- `PATCH /api/admin/resources/candidates/[id]`
- `DELETE /api/admin/resources/candidates/[id]`
- `GET /api/admin/resources/projects`
- `GET /api/admin/resources/projects/[id]`
- `PATCH /api/admin/resources/projects/[id]`
- `DELETE /api/admin/resources/projects/[id]`
- `GET /api/admin/resources/files`
- `GET /api/admin/resources/files/[id]`
- `DELETE /api/admin/resources/files/[id]`

## 10. Prisma schema tóm tắt

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("USER") // ADMIN | USER
  createdAt DateTime @default(now())
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        String   @default("HR") // HR_ADMIN | HR | MANAGER
  joinedAt    DateTime @default(now())

  @@unique([workspaceId, userId])
}

model Candidate {
  id                  String   @id @default(cuid())
  workspaceId         String
  hrId                String
  cvFileId            String?  @unique
  projectId           String?
  managerDecision     String?
  managerOfferSalary  String?
  managerReviewNote   String?
  managerReviewedAt   DateTime?
  managerReviewedById String?
  status              String   @default("NEW")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

## 11. Seed data

Seed hiện tạo sẵn:

- 1 system admin
- 2 HR
- 1 manager
- workspace `Talent Ops Vietnam` có `HR_ADMIN`, `HR`, `MANAGER`
- workspace `Creative Hiring Lab`
- project mẫu
- candidate mẫu có cả manager review và status history

Tài khoản demo:

- `admin@cvscanner.local` / `Admin@123`
- `thao@cvscanner.local` / `User@123`
- `quan@cvscanner.local` / `User@123`
- `manager@cvscanner.local` / `User@123`

## 12. Biến môi trường

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Gemini API key được nhập từ client khi scan AI, không bắt buộc khai báo trong `.env`.

## 13. Cách chạy

```bash
npm install
npm run db:setup
npm run dev
```

## 14. Ghi chú đồng bộ tài liệu

Tài liệu này đã được cập nhật theo code hiện tại:

- dùng role workspace `HR_ADMIN`, `HR`, `MANAGER`
- không còn nhầm lẫn giữa `ADMIN` toàn hệ thống và workspace admin
- không còn menu admin trong workspace
- có khu `/admin` riêng bằng `react-admin`
- có monitor hệ thống cho uploads, SQLite và disk
- manager được review và chốt final status trong candidate flow
