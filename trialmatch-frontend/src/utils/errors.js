export function getApiErrorMessage(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return fallback;
}
