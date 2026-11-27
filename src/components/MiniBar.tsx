/** A thin bar showing roughly how far through a book someone is */
export default function MiniBar({ percent }: { percent: number | null }) {
  const p = percent ?? 0;
  return (
    <span className="mini-bar" title={`About ${p}% read`}>
      <span style={{ width: `${p}%` }} />
    </span>
  );
}
