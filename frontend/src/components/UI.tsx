import { ReactNode } from "react";
import { toast } from "sonner";
export function State({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: ReactNode;
}) {
  return loading ? (
    <div role="status" className="skeleton">
      Loading your church information…
    </div>
  ) : error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : (
    <>{children}</>
  );
}
export function Heading({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">CHURCH COMMUNITY</p>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
export async function action(
  fn: () => Promise<unknown>,
  message = "Saved successfully",
) {
  try {
    await fn();
    toast.success(message);
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}
export function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
