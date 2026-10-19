// A simple row of tab buttons.
// tabs: [{ id, label }], current: id of the active tab, onChange(id)

export default function Tabs({ tabs, current, onChange }) {
  return (
    <nav className="tabs no-print">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === current ? 'tab active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
