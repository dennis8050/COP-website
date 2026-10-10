import { useEffect, useState } from "react";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { Heading, State, action } from "../components/UI";
import { useAuth } from "../hooks/auth";
import { Html5Qrcode } from "html5-qrcode";
export default function Attendance({ scanner = false }: { scanner?: boolean }) {
  const { user } = useAuth();
  const canCorrect = user?.role === "ADMIN" || user?.role === "PASTOR";
  const services = useData("/services?limit=100");
  const [service, setService] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const members = useData(
    `/members?status=active&search=${encodeURIComponent(search)}&page=${page}`,
  );
  const records = useData(`/attendance?service_id=${service}&limit=100`);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);
  const [camera, setCamera] = useState<Html5Qrcode>();
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(selected).length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigation = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (
        link &&
        Object.keys(selected).length &&
        !confirm("You have unsaved attendance. Leave this page?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", navigation, true);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigation, true);
    };
  }, [selected]);
  useEffect(
    () => () => {
      camera?.stop().catch(() => {});
    },
    [camera],
  );
  async function record(member_id: string, status = "present") {
    return api("/attendance", "POST", {
      member_id,
      service_id: service,
      status,
      attendance_method: "MANUAL",
    });
  }
  async function start() {
    if (!service) {
      setResult("Choose a service first");
      return;
    }
    try {
      const c = new Html5Qrcode("qr-reader");
      setCamera(c);
      let locked = false;
      await c.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        async (token) => {
          if (locked) return;
          locked = true;
          try {
            const x = await api("/attendance/scan", "POST", {
              token,
              service_id: service,
            });
            setResult(
              `Attendance Recorded · ${x.member_name} · ${x.service_name} · ${new Date(x.check_in_time).toLocaleString()}`,
            );
            records.reload();
          } catch (e) {
            setResult((e as Error).message);
          }
          setTimeout(() => (locked = false), 2500);
        },
        () => {},
      );
      setRunning(true);
    } catch (e) {
      setResult(
        "Camera could not start. Allow camera permission and use HTTPS or localhost. " +
          (e as Error).message,
      );
    }
  }
  return (
    <>
      <Heading
        title={scanner ? "Scan QR code" : "Attendance"}
        sub={
          scanner
            ? "Choose a service, point your camera, and welcome each member."
            : "A simple check-in for every service."
        }
      />
      <div className="card toolbar">
        <label>
          Service
          <select
            value={service}
            onChange={(e) => {
              if (
                Object.keys(selected).length &&
                !confirm("Discard unsaved attendance and change service?")
              )
                return;
              setService(e.target.value);
              setSelected({});
            }}
            disabled={running}
          >
            <option value="">Select a service</option>
            {services.data?.items
              ?.filter((s: any) => s.status !== "cancelled")
              .map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.date?.slice(0, 10)}
                </option>
              ))}
          </select>
        </label>
      </div>
      {scanner ? (
        <div className="card scanner">
          <div id="qr-reader" />
          {result && (
            <div role="status" className="notice">
              {result}
            </div>
          )}
          <button
            onClick={
              running
                ? async () => {
                    await camera?.stop();
                    setRunning(false);
                  }
                : start
            }
          >
            {running ? "Stop camera" : "Start camera"}
          </button>
          <p className="muted">
            Your camera stays on your device. Only the decoded member token is
            sent to record attendance.
          </p>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              aria-label="Search members"
              placeholder="Search name, email, phone or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <button
              className="secondary"
              disabled={!service}
              onClick={() =>
                setSelected(
                  Object.fromEntries(
                    (members.data?.items || []).map((m: any) => [
                      m.id,
                      "present",
                    ]),
                  ),
                )
              }
            >
              Select this page present
            </button>
            <button
              disabled={!service || !Object.keys(selected).length}
              onClick={() =>
                action(async () => {
                  const pending = { ...selected };
                  for (const [id, status] of Object.entries(pending)) {
                    await record(id, status);
                    delete pending[id];
                    setSelected({ ...pending });
                  }
                  records.reload();
                }, "Attendance saved")
              }
            >
              Save attendance ({Object.keys(selected).length})
            </button>
            <button className="secondary" onClick={() => setSelected({})}>
              Clear selection
            </button>
          </div>
          <State loading={members.loading} error={members.error}>
            <div className="card">
              {members.data?.items?.map((m: any) => (
                <div className="attendance-row" key={m.id}>
                  <div>
                    <strong>
                      {m.first_name} {m.last_name}
                    </strong>
                    <small>{m.email}</small>
                  </div>
                  <div className="buttons">
                    {["present", "absent", "excused"].map((status) => (
                      <button
                        disabled={!service}
                        key={status}
                        className={selected[m.id] === status ? "" : "secondary"}
                        onClick={() =>
                          setSelected({ ...selected, [m.id]: status })
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={page * 20 >= (members.data?.total || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </State>
        </>
      )}
      {service && (
        <div className="card table-wrap">
          <h2>Recorded attendance</h2>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Method</th>
                <th>Correction</th>
              </tr>
            </thead>
            <tbody>
              {records.data?.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    {a.first_name} {a.last_name}
                  </td>
                  <td>{a.status}</td>
                  <td>{a.attendance_method}</td>
                  <td>
                    <select
                      disabled={!canCorrect}
                      aria-label="Correct attendance"
                      value={a.status}
                      onChange={(e) =>
                        action(async () => {
                          await api("/attendance/" + a.id, "PUT", {
                            status: e.target.value,
                          });
                          records.reload();
                        })
                      }
                    >
                      {["present", "absent", "excused"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm("Delete this attendance record?"))
                          action(async () => {
                            await api("/attendance/" + a.id, "DELETE");
                            records.reload();
                          });
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
