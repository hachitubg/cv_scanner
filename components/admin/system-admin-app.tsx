"use client";

import { useMemo } from "react";
import {
  Admin,
  Create,
  Datagrid,
  DateField,
  DeleteButton,
  Edit,
  EditButton,
  EmailField,
  FunctionField,
  List,
  NumberField,
  Resource,
  SelectInput,
  Show,
  SimpleShowLayout,
  SimpleForm,
  TextField,
  TextInput,
  UrlField,
  type DataProvider,
  fetchUtils,
} from "react-admin";

import { SystemAdminDashboard } from "@/components/admin/system-admin-dashboard";

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetchUtils.fetchJson(url, {
    ...options,
    headers: new Headers({
      Accept: "application/json",
      ...(options.headers as HeadersInit),
    }),
  });

  return response.json;
}

function buildDataProvider(): DataProvider {
  const base = "/api/admin/resources";

  return {
    async getList(resource, params) {
      const url = new URL(`${base}/${resource}`, window.location.origin);
      const page = params.pagination?.page ?? 1;
      const perPage = params.pagination?.perPage ?? 25;
      const sortField = params.sort?.field ?? "createdAt";
      const sortOrder = params.sort?.order ?? "DESC";

      url.searchParams.set("page", String(page));
      url.searchParams.set("perPage", String(perPage));
      url.searchParams.set("sort", sortField);
      url.searchParams.set("order", sortOrder);
      url.searchParams.set("filter", JSON.stringify(params.filter ?? {}));

      const json = (await requestJson(url.toString())) as { data: Record<string, unknown>[]; total: number };
      return { data: json.data as never[], total: json.total };
    },

    async getOne(resource, params) {
      const json = (await requestJson(`${base}/${resource}/${params.id}`)) as { data: Record<string, unknown> };
      return { data: json.data as never };
    },

    async getMany(resource, params) {
      const records = await Promise.all(params.ids.map((id) => this.getOne(resource, { id, meta: params.meta })));
      return { data: records.map((record) => record.data) as never[] };
    },

    async getManyReference(resource, params) {
      return this.getList(resource, {
        pagination: params.pagination,
        sort: params.sort,
        filter: { ...params.filter, [params.target]: params.id },
        meta: params.meta,
      });
    },

    async create(resource, params) {
      const json = (await requestJson(`${base}/${resource}`, {
        method: "POST",
        body: JSON.stringify(params.data),
      })) as { data: Record<string, unknown> };
      return { data: json.data as never };
    },

    async update(resource, params) {
      const json = (await requestJson(`${base}/${resource}/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(params.data),
      })) as { data: Record<string, unknown> };
      return { data: json.data as never };
    },

    async updateMany(resource, params) {
      const results = await Promise.all(
        params.ids.map((id) => this.update(resource, { id, data: params.data, previousData: params.data })),
      );
      return { data: results.map((result) => (result.data as { id: string | number }).id) };
    },

    async delete(resource, params) {
      const json = (await requestJson(`${base}/${resource}/${params.id}`, {
        method: "DELETE",
      })) as { data: Record<string, unknown> };
      return { data: { id: params.id, ...json.data } as never };
    },

    async deleteMany(resource, params) {
      await Promise.all(params.ids.map((id) => this.delete(resource, { id, previousData: {} as never })));
      return { data: params.ids };
    },
  };
}

const roleChoices = [
  { id: "USER", name: "User" },
  { id: "ADMIN", name: "Admin" },
];

const candidateStatusChoices = [
  "NEW",
  "REVIEWING",
  "PASS_CV",
  "FAIL_CV",
  "INTERVIEW",
  "INTERVIEWED",
  "PASSED",
  "INTERVIEW_FAILED",
  "OFFERED",
  "OFFER_DECLINED",
  "ONBOARDED",
  "REJECTED",
].map((item) => ({ id: item, name: item }));

const managerDecisionChoices = [
  { id: "PENDING", name: "PENDING" },
  { id: "APPROVED", name: "APPROVED" },
  { id: "REJECTED", name: "REJECTED" },
];

function UsersList() {
  return (
    <List perPage={25} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="name" />
        <EmailField source="email" />
        <TextField source="role" />
        <NumberField source="workspaceCount" />
        <DateField source="createdAt" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function UsersEdit() {
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="name" fullWidth />
        <TextInput source="email" fullWidth />
        <SelectInput source="role" choices={roleChoices} />
        <TextInput source="password" type="password" fullWidth helperText="Để trống nếu không đổi mật khẩu." />
      </SimpleForm>
    </Edit>
  );
}

function UsersCreate() {
  return (
    <Create mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="name" fullWidth />
        <TextInput source="email" fullWidth />
        <TextInput source="password" type="password" fullWidth />
        <SelectInput source="role" choices={roleChoices} defaultValue="USER" />
      </SimpleForm>
    </Create>
  );
}

function WorkspacesList() {
  return (
    <List perPage={25} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="name" />
        <TextField source="ownerName" label="Chủ workspace" />
        <NumberField source="memberCount" />
        <NumberField source="candidateCount" />
        <NumberField source="fileCount" />
        <DateField source="createdAt" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function WorkspacesEdit() {
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="name" fullWidth />
      </SimpleForm>
    </Edit>
  );
}

function CandidatesList() {
  return (
    <List perPage={25} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="fullName" />
        <EmailField source="email" />
        <TextField source="position" />
        <TextField source="status" />
        <TextField source="workspaceName" />
        <TextField source="hrName" />
        <TextField source="managerDecision" />
        <DateField source="updatedAt" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function CandidatesEdit() {
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="fullName" fullWidth />
        <TextInput source="email" fullWidth />
        <TextInput source="phone" fullWidth />
        <TextInput source="position" fullWidth />
        <TextInput source="source" fullWidth />
        <TextInput source="offerSalary" fullWidth />
        <SelectInput source="status" choices={candidateStatusChoices} />
        <SelectInput source="managerDecision" choices={managerDecisionChoices} />
        <TextInput source="managerOfferSalary" fullWidth />
        <TextInput source="managerReviewNote" fullWidth multiline minRows={4} />
        <TextInput source="notes" fullWidth multiline minRows={4} />
      </SimpleForm>
    </Edit>
  );
}

function ProjectsList() {
  return (
    <List perPage={25} sort={{ field: "updatedAt", order: "DESC" }}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="name" />
        <TextField source="workspaceName" />
        <FunctionField
          label="Mô tả"
          render={(record: { description?: string | null }) => record.description || "-"}
        />
        <DateField source="updatedAt" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function ProjectsEdit() {
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="name" fullWidth />
        <TextInput source="description" fullWidth multiline minRows={4} />
      </SimpleForm>
    </Edit>
  );
}

function FilesList() {
  return (
    <List perPage={25} sort={{ field: "uploadedAt", order: "DESC" }}>
      <Datagrid bulkActionButtons={false}>
        <TextField source="fileName" />
        <TextField source="workspaceName" />
        <FunctionField label="Người upload" render={(record: { uploaderName?: string }) => record.uploaderName || "-"} />
        <FunctionField
          label="Kích thước"
          render={(record: { fileSize?: number }) => `${((record.fileSize || 0) / 1024).toFixed(0)} KB`}
        />
        <UrlField source="filePath" />
        <DateField source="uploadedAt" showTime />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function LogsList() {
  return (
    <List perPage={25} sort={{ field: "updatedAt", order: "DESC" }}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <TextField source="fileName" label="File log" />
        <FunctionField
          label="Dung lượng"
          render={(record: { sizeBytes?: number }) => `${((record.sizeBytes || 0) / 1024).toFixed(1)} KB`}
        />
        <DateField source="updatedAt" label="Cập nhật" showTime />
        <DateField source="retainedUntil" label="Tự dọn sau" showTime />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}

function LogsShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="fileName" label="File log" />
        <FunctionField
          label="Dung lượng"
          render={(record: { sizeBytes?: number }) => `${((record.sizeBytes || 0) / 1024).toFixed(1)} KB`}
        />
        <DateField source="updatedAt" label="Cập nhật" showTime />
        <DateField source="retainedUntil" label="Tự dọn sau" showTime />
        <FunctionField
          label="Tail log gần nhất"
          render={(record: { tailText?: string; tailBytes?: number }) => (
            <pre
              style={{
                maxHeight: 560,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                borderRadius: 16,
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 18,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {record.tailText || `Không có nội dung trong ${record.tailBytes || 0} byte cuối.`}
            </pre>
          )}
        />
      </SimpleShowLayout>
    </Show>
  );
}

export function SystemAdminApp() {
  const dataProvider = useMemo(() => buildDataProvider(), []);

  return (
    <Admin
      dataProvider={dataProvider}
      dashboard={SystemAdminDashboard}
      title="CV Scanner Admin"
      disableTelemetry
    >
      <Resource name="users" list={UsersList} edit={UsersEdit} create={UsersCreate} />
      <Resource name="workspaces" list={WorkspacesList} edit={WorkspacesEdit} />
      <Resource name="candidates" list={CandidatesList} edit={CandidatesEdit} />
      <Resource name="projects" list={ProjectsList} edit={ProjectsEdit} />
      <Resource name="files" list={FilesList} />
      <Resource name="logs" list={LogsList} show={LogsShow} options={{ label: "Logs" }} />
    </Admin>
  );
}
