import { useState, useEffect } from "react";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { Heading, State, action } from "../components/UI";
export function Users() {
  const { data, loading, error, reload } = useData("/users");
  return (
    <>
      <Heading title="User access" sub="Manage roles and account status." />
      <State loading={loading} error={error}>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      aria-label={"Role for " + u.name}
                      onChange={(e) =>
                        action(async () => {
                          await api("/users/" + u.id, "PUT", {
                            role: e.target.value,
                            status: u.status,
                          });
                          reload();
                        })
                      }
                    >
                      {["ADMIN", "PASTOR", "STAFF", "MEMBER"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.status}
                      aria-label={"Status for " + u.name}
                      onChange={(e) =>
                        action(async () => {
                          await api("/users/" + u.id, "PUT", {
                            role: u.role,
                            status: e.target.value,
                          });
                          reload();
                        })
                      }
                    >
                      <option>active</option>
                      <option>inactive</option>
                    </select>
                  </td>
                  <td>
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
    </>
  );
}
export default function Settings() {
  const { data, loading, error, reload } = useData("/settings");
  const [times, setTimes] = useState<{ name: string; time: string }[]>([]);
  useEffect(() => {
    if (data) setTimes(data.service_times || []);
  }, [data]);
  return (
    <>
      <Heading
        title="Church settings"
        sub="Keep your public church information up to date."
      />
      <State loading={loading} error={error}>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            action(async () => {
              await api("/settings", "PUT", {
                ...d,
                service_times: times,
                social_links: String(d.social_links)
                  .split("\n")
                  .filter(Boolean),
              });
              reload();
            });
          }}
        >
          <div className="grid two">
            {[
              "church_name",
              "mission",
              "vision",
              "values",
              "address",
              "email",
              "phone",
            ].map((k) => (
              <label key={k}>
                {k.replaceAll("_", " ")}
                <input name={k} defaultValue={data?.[k]} required />
              </label>
            ))}
          </div>
          <label>
            Social links (one per line)
            <textarea
              name="social_links"
              defaultValue={data?.social_links?.join("\n")}
            />
          </label>
          <h2>Weekly service schedule</h2>
          {times.map((item, i) => (
            <div className="grid two" key={i}>
              <label>
                Service name
                <input
                  value={item.name}
                  required
                  maxLength={100}
                  onChange={(e) =>
                    setTimes(
                      times.map((x, n) =>
                        n === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Times
                <input
                  value={item.time}
                  required
                  maxLength={100}
                  placeholder="9:00 AM – 11:00 AM"
                  onChange={(e) =>
                    setTimes(
                      times.map((x, n) =>
                        n === i ? { ...x, time: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="danger"
                onClick={() => setTimes(times.filter((_, n) => n !== i))}
              >
                Remove service time
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setTimes([...times, { name: "", time: "" }])}
            disabled={times.length >= 20}
          >
            Add service time
          </button>
          <button>Save church settings</button>
        </form>
      </State>
    </>
  );
}
