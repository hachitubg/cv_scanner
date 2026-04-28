# Design Notes

## 1. Product direction

Lệ HR - CV Manager Scanner được thiết kế theo hướng "playful professional":

- giao diện sáng, mềm, nhiều lớp surface;
- ưu tiên đọc nhanh candidate pipeline;
- role-based UX rõ ràng, không trộn quyền HR và manager;
- tách riêng không gian thao tác workspace và system admin.

## 2. UX principle theo quyền

### System admin

- `ADMIN` toàn hệ thống không thao tác trong workspace như một màn hình admin riêng.
- `ADMIN` vào `/admin` để quản lý toàn bộ data và monitor tài nguyên hệ thống.
- Dashboard admin ưu tiên thông tin vận hành:
  - uploads size
  - SQLite size
  - disk usage
  - top workspace theo storage
  - recent uploads

### Workspace HR admin

- `HR_ADMIN` là admin của workspace, không phải admin của hệ thống.
- Mục tiêu UX: quản lý workspace ngay trong workspace, không cần "admin panel" riêng.
- `HR_ADMIN` thấy đầy đủ members, projects, upload, candidate actions.

### Workspace HR

- `HR` là role vận hành.
- UI ưu tiên:
  - upload CV
  - sửa candidate được giao cho mình
  - đổi trạng thái vận hành của HR
- Không nên cho HR thấy những action vượt phạm vi candidate mình phụ trách.

### Manager

- `MANAGER` là role review surface, không phải data entry surface.
- UI phải tập trung vào:
  - đọc thông tin CV
  - xem bối cảnh candidate
  - ghi manager review
  - chốt final status
- Manager không nên thấy CTA upload, members, projects, hay form edit HR đầy đủ.

## 3. Navigation rules

### Workspace sidebar

Sidebar workspace hiện tại nên giữ logic sau:

- `Dashboard`: tất cả membership đều thấy
- `Kho CV`: tất cả membership đều thấy
- `Upload CV`: chỉ `HR_ADMIN`, `HR`
- `Dự án`: chỉ `HR_ADMIN`
- `Thành viên`: chỉ `HR_ADMIN`
- Không hiện menu admin tổng hệ thống trong workspace

### System admin entry

- Truy cập bằng URL `/admin`
- Chỉ `ADMIN` toàn hệ thống vào được
- Có top bar riêng và link quay lại `/workspaces`

## 4. Candidate screens

### Candidate list

Mỗi candidate card/list item nên có 2 lớp thông tin:

- lớp vận hành của HR
- lớp review của manager

UI cần cho thấy rõ:

- tên ứng viên
- vị trí
- HR phụ trách
- project
- status hiện tại
- manager decision
- offer manager đề xuất nếu có

### Candidate detail

Mục tiêu là cho từng role một "mặt phẳng thao tác" đúng:

- `HR_ADMIN`: sửa full data, review nếu cần, xóa nếu cần
- `HR`: sửa dữ liệu HR nếu candidate thuộc mình
- `MANAGER`: tập trung vào khối manager review và final status

Nếu người dùng là manager, màn hình cần giảm nhiễu:

- ẩn/vô hiệu hóa các field HR edit
- giữ review box nổi bật
- nhấn mạnh quyết định manager và thời điểm review

## 5. Status design

### Candidate status

Hệ thống đang dùng:

- `NEW`
- `REVIEWING`
- `PASS_CV`
- `FAIL_CV`
- `INTERVIEW`
- `INTERVIEWED`
- `PASSED`
- `INTERVIEW_FAILED`
- `OFFERED`
- `OFFER_DECLINED`
- `ONBOARDED`
- `REJECTED`

### Manager decision

- `PENDING`
- `APPROVED`
- `REJECTED`

### Manager final statuses

Manager chỉ được chốt các status sau:

- `OFFERED`
- `OFFER_DECLINED`
- `ONBOARDED`
- `REJECTED`

Màu sắc badge cần nhất quán giữa:

- candidate list
- candidate detail
- dashboard/filter
- meta mapping trong `lib/utils.ts`

## 6. Admin dashboard design

System admin dashboard không cần quá "marketing". Nó là công cụ vận hành.

Cần ưu tiên:

- đọc số nhanh trong 1 màn hình
- metric cards lớn, contrast rõ
- chart đơn giản, dễ quét nhanh
- bảng recent uploads để tìm workspace/file đang tăng dung lượng

Không nên:

- trộn system monitor với workspace workflow
- đưa candidate CRUD vào navigation workspace
- dùng cùng một ngôn ngữ điều hướng với HR workspace

## 7. Product alignment checklist

Khi cập nhật UI hoặc tài liệu, cần giữ đồng bộ với code hiện tại:

- role workspace là `HR_ADMIN`, `HR`, `MANAGER`
- `ADMIN` là role toàn hệ thống, vào `/admin`
- workspace không có menu admin riêng
- `HR_ADMIN` full quyền trong workspace
- `HR` chỉ thao tác candidate mình phụ trách
- `MANAGER` review và chốt final status
- system admin dashboard có monitor uploads, SQLite, disk, top storage workspaces, recent uploads
