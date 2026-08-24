import Link from "next/link";
import { adminContent } from "@/content/admin";
import { getDatabase } from "@/db/client";
import {
  adminUserPageSizes,
  listAdminUsers,
  type AdminUserPageSize,
} from "@/modules/identity-access/admin-repository";
import {
  accountStatuses,
  type AccountStatus,
} from "@/modules/identity-access/authorization";
import {
  applicationRoleCodes,
  type ApplicationRoleCode,
} from "@/modules/identity-access/policy";
import { requireIdentityAdminPrincipal } from "../admin-principal";

export const dynamic = "force-dynamic";

type SearchValues = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function roleFilter(value: string | undefined): ApplicationRoleCode | undefined {
  return (applicationRoleCodes as readonly string[]).includes(value ?? "")
    ? (value as ApplicationRoleCode)
    : undefined;
}

function statusFilter(value: string | undefined): AccountStatus | undefined {
  return (accountStatuses as readonly string[]).includes(value ?? "")
    ? (value as AccountStatus)
    : undefined;
}

function positivePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

function pageSize(value: string | undefined): AdminUserPageSize {
  const size = Number.parseInt(value ?? "20", 10);
  return (adminUserPageSizes as readonly number[]).includes(size)
    ? (size as AdminUserPageSize)
    : 20;
}

function dateLabel(locale: "bg" | "en", value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : adminContent[locale].never;
}

function pageHref(
  values: { query?: string; role?: string; status?: string; pageSize: number },
  page: number,
) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.role) params.set("role", values.role);
  if (values.status) params.set("status", values.status);
  params.set("pageSize", String(values.pageSize));
  params.set("page", String(page));
  return `/app/admin/users?${params.toString()}`;
}

export default async function AdminUserListPage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const [principal, values] = await Promise.all([
    requireIdentityAdminPrincipal(),
    searchParams,
  ]);
  const locale = principal.profile.preferredLocale;
  const copy = adminContent[locale];
  const query = first(values.q)?.trim().slice(0, 160) || undefined;
  const role = roleFilter(first(values.role));
  const status = statusFilter(first(values.status));
  const requestedPage = positivePage(first(values.page));
  const requestedPageSize = pageSize(first(values.pageSize));
  const users = await listAdminUsers(getDatabase(), {
    page: requestedPage,
    pageSize: requestedPageSize,
    query,
    role,
    status,
  });
  const lastPage = Math.max(1, Math.ceil(users.total / users.pageSize));
  const filters = { query, role, status, pageSize: users.pageSize };

  return (
    <section className="admin-page" aria-labelledby="admin-users-title">
      <header className="admin-page-header">
        <p className="eyebrow">{copy.list.eyebrow}</p>
        <h1 id="admin-users-title">{copy.list.title}</h1>
        <p>{copy.list.intro}</p>
      </header>

      <form className="admin-filters" method="get" role="search">
        <label>
          <span>{copy.list.search}</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder={copy.list.searchPlaceholder}
            maxLength={160}
          />
        </label>
        <label>
          <span>{copy.list.status}</span>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">{copy.list.all}</option>
            {accountStatuses.map((code) => (
              <option key={code} value={code}>{copy.statusLabels[code]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.list.role}</span>
          <select name="role" defaultValue={role ?? ""}>
            <option value="">{copy.list.all}</option>
            {applicationRoleCodes.map((code) => (
              <option key={code} value={code}>{copy.roleLabels[code]}</option>
            ))}
          </select>
        </label>
        <input type="hidden" name="pageSize" value={users.pageSize} />
        <div className="admin-filter-actions">
          <button type="submit">{copy.list.apply}</button>
          <Link href="/app/admin/users">{copy.list.clear}</Link>
        </div>
      </form>

      <p className="admin-provider-note">{copy.list.providerEmailUnavailable}</p>
      <p className="admin-page-summary" aria-live="polite">
        {copy.list.pageSummary(users.page, users.total)}
      </p>

      {users.items.length === 0 ? (
        <p className="admin-empty-state">{copy.list.empty}</p>
      ) : (
        <ul className="admin-user-list">
          {users.items.map((user) => (
            <li key={user.id}>
              <div className="admin-user-card-heading">
                <h2>{user.displayName}</h2>
                <span className={`admin-status admin-status--${user.status.toLowerCase()}`}>
                  {copy.statusLabels[user.status]}
                </span>
              </div>
              <dl>
                <div>
                  <dt>{copy.list.roles}</dt>
                  <dd>
                    {user.roles.length > 0
                      ? user.roles.map((code) => copy.roleLabels[code]).join(", ")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{copy.list.locale}</dt>
                  <dd>{user.preferredLocale.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>{copy.list.created}</dt>
                  <dd>
                    <time dateTime={user.createdAt.toISOString()}>
                      {dateLabel(locale, user.createdAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>{copy.list.lastActivity}</dt>
                  <dd>
                    {user.lastSafeActivityAt ? (
                      <time dateTime={user.lastSafeActivityAt.toISOString()}>
                        {dateLabel(locale, user.lastSafeActivityAt)}
                      </time>
                    ) : copy.never}
                  </dd>
                </div>
              </dl>
              <Link className="admin-user-link" href={`/app/admin/users/${user.id}`}>
                {copy.list.view}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className="admin-pagination" aria-label={copy.list.pageSummary(users.page, users.total)}>
        {users.page > 1 ? (
          <Link href={pageHref(filters, users.page - 1)}>{copy.list.previous}</Link>
        ) : <span aria-hidden="true" />}
        {users.page < lastPage ? (
          <Link href={pageHref(filters, users.page + 1)}>{copy.list.next}</Link>
        ) : null}
      </nav>
    </section>
  );
}
