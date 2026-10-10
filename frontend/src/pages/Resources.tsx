import { useState } from "react";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { Heading, State, action } from "../components/UI";
import { useAuth } from "../hooks/auth";
import QRCode from "qrcode";
const fieldSets: Record<string, string[]> = {
  members: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "gender",
    "address",
    "emergency_contact",
    "membership_date",
    "ministry_id",
    "profile_photo",
    "status",
  ],
  services: [
    "name",
    "description",
    "date",
    "start_time",
    "end_time",
    "location",
    "status",
  ],
  events: [
    "name",
    "description",
    "date",
    "start_time",
    "end_time",
    "location",
    "maximum_capacity",
    "registration_required",
    "image",
  ],
  ministries: [
    "name",
    "description",
    "leader_id",
    "meeting_schedule",
    "status",
  ],
};
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
export default function Resources({ resource }: { resource: string }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [ministry, setMinistry] = useState("");
  const [gender, setGender] = useState("");
  const [registered, setRegistered] = useState("");
  const [editing, setEditing] = useState<any>();
  const [history, setHistory] = useState<any>();
  const ministries = useData("/ministries?limit=100");
  const { data, loading, error, reload } = useData(
    `/${resource}?page=${page}&search=${encodeURIComponent(search)}&status=${status}&ministry_id=${ministry}&gender=${gender}&registered_from=${registered}`,
  );
  const canWrite =
    user?.role === "ADMIN" ||
    (resource !== "members" && user?.role === "PASTOR");
  return (
    <>
      <Heading
        title={label(resource)}
        sub="Care for your community. Keep every detail connected."
      >
        {canWrite && (
          <button onClick={() => setEditing({})}>
            + Add {resource.slice(0, -1)}
          </button>
        )}
      </Heading>
      <div className="toolbar">
        <input
          aria-label="Search"
          placeholder="Search by name, email, phone or ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {resource === "members" && (
          <>
            <select
              aria-label="Membership status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option>active</option>
              <option>inactive</option>
            </select>
            <select
              aria-label="Ministry"
              value={ministry}
              onChange={(e) => setMinistry(e.target.value)}
            >
              <option value="">All ministries</option>
              {ministries.data?.items?.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">All genders</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
            <label>
              Registered since
              <input
                type="date"
                value={registered}
                onChange={(e) => setRegistered(e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <State loading={loading} error={error}>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{resource === "members" ? "Member" : "Name"}</th>
                <th>{resource === "members" ? "Contact" : "Description"}</th>
                <th>Status / Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((x: any) => (
                <tr key={x.id}>
                  <td>
                    <strong>
                      {x.name || x.first_name + " " + x.last_name}
                    </strong>
                    <small>{x.id}</small>
                  </td>
                  <td>
                    {x.email || x.description}
                    <small>{x.phone || x.location}</small>
                  </td>
                  <td>
                    <span className="badge">
                      {x.status || x.date?.slice(0, 10)}
                    </span>
                  </td>
                  <td>
                    <div className="buttons">
                      {resource === "members" && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            const attendance = await api(
                              `/members/${x.id}/attendance`,
                            );
                            setHistory({ member: x, attendance });
                          }}
                        >
                          View
                        </button>
                      )}
                      {canWrite && (
                        <>
                          <button
                            className="secondary"
                            onClick={() => setEditing(x)}
                          >
                            Edit
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this " +
                                    resource.slice(0, -1) +
                                    "?",
                                )
                              )
                                action(async () => {
                                  await api(
                                    "/" + resource + "/" + x.id,
                                    "DELETE",
                                  );
                                  reload();
                                }, "Record safely removed");
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items?.length && (
            <div className="empty">
              No records found. Try a different search.
            </div>
          )}
        </div>
        <div className="pagination">
          <button
            className="secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} · {data?.total || 0} records
          </span>
          <button
            className="secondary"
            disabled={page * 20 >= (data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </State>
      {editing && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Edit record"
            className="card modal"
          >
            <h2>
              {editing.id ? "Edit" : "Create"} {resource.slice(0, -1)}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const d = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as any;
                for (const k of Object.keys(d)) {
                  if (d[k] === "") delete d[k];
                }
                if (d.maximum_capacity)
                  d.maximum_capacity = Number(d.maximum_capacity);
                if (resource === "events")
                  d.registration_required = d.registration_required === "true";
                if (
                  await action(() =>
                    api(
                      "/" + resource + (editing.id ? "/" + editing.id : ""),
                      editing.id ? "PUT" : "POST",
                      d,
                    ),
                  )
                ) {
                  setEditing(undefined);
                  reload();
                }
              }}
            >
              <div className="grid two">
                {fieldSets[resource].map((k) => (
                  <label key={k}>
                    {label(k)}
                    {k === "ministry_id" ? (
                      <select name={k} defaultValue={editing[k] || ""}>
                        <option value="">Unassigned</option>
                        {ministries.data?.items?.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : k === "status" ? (
                      <select name={k} defaultValue={editing[k] || "active"}>
                        {(resource === "services"
                          ? ["scheduled", "completed", "cancelled"]
                          : ["active", "inactive"]
                        ).map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    ) : k === "registration_required" ? (
                      <select
                        name={k}
                        defaultValue={String(editing[k] || false)}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    ) : (
                      <input
                        name={k}
                        defaultValue={
                          editing[k]?.slice?.(
                            0,
                            k.includes("date") || k === "date" ? 10 : undefined,
                          ) ||
                          editing[k] ||
                          ""
                        }
                        required={[
                          "first_name",
                          "last_name",
                          "name",
                          "date",
                          "start_time",
                        ].includes(k)}
                        type={
                          k === "email"
                            ? "email"
                            : k.includes("date") || k === "date"
                              ? "date"
                              : k.includes("time")
                                ? "time"
                                : k === "maximum_capacity"
                                  ? "number"
                                  : k === "image" || k === "profile_photo"
                                    ? "url"
                                    : "text"
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="buttons">
                <button>Save changes</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(undefined)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {history && (
        <div className="modal-backdrop">
          <section
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-label="Member history"
          >
            <h2>
              {history.member.first_name} {history.member.last_name}
            </h2>
            <p>
              {history.member.email} · {history.member.phone}
            </p>
            <p>{history.member.address}</p>
            <p>Membership: {history.member.membership_date?.slice(0, 10)}</p>
            <p>
              Attendance:{" "}
              {history.attendance.length
                ? Math.round(
                    (history.attendance.filter(
                      (a: any) => a.status === "present",
                    ).length /
                      history.attendance.length) *
                      100,
                  )
                : 0}
              %
            </p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.attendance.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.date?.slice(0, 10)}</td>
                    <td>{a.name}</td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.member.qr_token && (
              <button
                className="secondary"
                onClick={async () => {
                  const url = await QRCode.toDataURL(history.member.qr_token);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "member-qr.png";
                  a.click();
                }}
              >
                Download QR
              </button>
            )}
            {user?.role === "ADMIN" && (
              <button
                className="secondary"
                onClick={() => {
                  if (
                    confirm(
                      "Replace this QR code? The old code will stop working.",
                    )
                  )
                    action(async () => {
                      const token = await api(
                        "/members/" + history.member.id + "/qr",
                        "POST",
                      );
                      setHistory({
                        ...history,
                        member: { ...history.member, qr_token: token.qr_token },
                      });
                    }, "QR code replaced");
                }}
              >
                Replace QR code
              </button>
            )}
            <button onClick={() => setHistory(undefined)}>Close</button>
          </section>
        </div>
      )}
    </>
  );
}
