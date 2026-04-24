# CV Scanner

Ứng dụng nội bộ cho team tuyển dụng để scan CV, quản lý ứng viên theo workspace, và tách rõ quyền giữa admin toàn hệ thống, HR workspace, và manager đánh giá nhân sự.

## Tổng quan

- Đăng ký, đăng nhập bằng `NextAuth` credentials.
- Quản lý nhiều workspace tuyển dụng trong cùng một hệ thống.
- Scan CV từ `PDF`, `DOCX`, `TXT`, `PNG`, `JPG`, `JPEG`, `WEBP`.
- OCR cho ảnh và PDF scan không có text.
- AI scan bằng Gemini khi người dùng nhập API key và chọn model.
- Quản lý ứng viên, dự án, lịch sử trạng thái, file CV, và dashboard theo workspace.
- Có khu `/admin` riêng cho `ADMIN` toàn hệ thống để monitor tài nguyên và quản lý dữ liệu.

## Mô hình quyền

Hệ thống có 2 lớp quyền riêng biệt:

### 1. Role toàn hệ thống

| Role | Phạm vi |
| --- | --- |
| `ADMIN` | Xem và quản lý toàn bộ data trong CV Scanner, vào được `/admin`, monitor upload/SQLite/disk, quản lý users, workspaces, candidates, projects, files |
| `USER` | Chỉ thao tác theo quyền membership trong từng workspace |

### 2. Role trong workspace

| Role | Quyền chính |
| --- | --- |
| `HR_ADMIN` | Full quyền trong workspace: quản lý members, projects, candidates, upload CV, xóa candidate, cấu hình phân quyền ngay trong workspace |
| `HR` | Upload CV, tạo/cập nhật candidate được gán cho chính mình, đổi các trạng thái vận hành của HR |
| `MANAGER` | Đọc CV, ghi đánh giá manager, chốt các trạng thái cuối như `OFFERED`, `OFFER_DECLINED`, `ONBOARDED`, `REJECTED` |

Lưu ý:

- `HR_ADMIN` không phải là admin toàn hệ thống.
- Workspace không còn menu admin riêng.
- `ADMIN` toàn hệ thống được tách ra thành khu `/admin`.

## Luồng chính

### Workspace

- Người dùng vào `/workspaces` để xem workspace mình tham gia.
- Trong workspace:
  - `HR_ADMIN` thấy đủ dashboard, kho CV, upload, projects, members.
  - `HR` thấy dashboard, kho CV, upload.
  - `MANAGER` thấy dashboard và kho CV để review, không có upload/projects/members.

### Candidate

- `HR_ADMIN` có thể sửa mọi candidate trong workspace.
- `HR` chỉ được sửa candidate nếu `candidate.hrId === currentUserId`.
- `MANAGER` không sửa dữ liệu HR; chỉ được cập nhật:
  - `managerDecision`
  - `managerOfferSalary`
  - `managerReviewNote`
  - `status` với các trạng thái final cho manager

### System admin

- Truy cập trực tiếp `GET /admin`.
- Giao diện dùng `react-admin`.
- Dashboard monitor hiển thị:
  - tổng users, workspaces, candidates, projects, files
  - tổng dung lượng `public/uploads`
  - kích thước `prisma/dev.db`
  - dung lượng disk còn trong / tổng dung lượng
  - top workspace theo dung lượng file CV
  - phân bố status ứng viên
  - recent uploads

## Công nghệ

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- NextAuth
- Zod
- `pdf-parse`, `mammoth`
- `tesseract.js`, `pdfjs-dist`, `@napi-rs/canvas`
- Gemini API
- `react-admin` + MUI cho system admin

## Chạy dự án

```bash
npm install
npm run db:setup
npm run dev
```

Ứng dụng chạy tại `http://localhost:3000`.

## Tài khoản seed

- Admin: `admin@cvscanner.local` / `Admin@123`
- HR: `thao@cvscanner.local` / `User@123`
- HR: `quan@cvscanner.local` / `User@123`
- Manager: `manager@cvscanner.local` / `User@123`

## Lệnh hữu ích

```bash
npm run db:setup
npm run db:seed
npm run lint
npm run build
```

## Ghi chú

- SQLite nằm ở `prisma/dev.db`.
- File upload nằm ở `public/uploads/<workspaceId>`.
- `npm run db:setup` sẽ tạo lại schema SQLite, generate Prisma Client, và seed dữ liệu demo.
- `/admin` chỉ dành cho `ADMIN` toàn hệ thống.
