import { redirect } from "next/navigation";

type RawParams = Record<string, string | string[] | undefined>;

/** Discovery now lives on the home page. Old /search links keep working:
 *  their query, category, price and sort carry over. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const key of ["q", "category", "min", "max", "sort"]) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) sp.set(key, first);
  }
  const qs = sp.toString();
  redirect(qs ? `/?${qs}` : "/");
}
