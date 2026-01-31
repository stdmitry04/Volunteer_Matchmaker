'use client';

export default function Navigation() {
  return (
    <nav className="w-64 border-r border-gray-200 min-h-screen p-4">
      <ul className="space-y-2">
        <li>
          <a href="/" className="block px-3 py-2 rounded-md hover:bg-gray-100">
            Home
          </a>
        </li>
      </ul>
    </nav>
  );
}
