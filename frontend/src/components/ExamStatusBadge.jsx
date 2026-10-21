// Status labels for examinations.

// The exam as a whole: marks entry is Open, or the results are Published.
export default function ExamStatusBadge({ status }) {
  return status === 'published' ? (
    <span className="badge good">Published</span>
  ) : (
    <span className="badge late">Open</span>
  );
}

// One subject's marks entry: Pending (nothing entered), In progress, or Submitted.
export function EntryStatusBadge({ status }) {
  if (status === 'submitted') return <span className="badge good">Submitted</span>;
  if (status === 'in_progress') return <span className="badge late">In progress</span>;
  return <span className="badge warning">Pending</span>;
}
