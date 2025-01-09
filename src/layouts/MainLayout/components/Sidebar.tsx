import { NavLink } from "react-router";
import "../styles/Sidebar.css";


export const Sidebar = () => {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink
              to="/tasks"
              className={({ isActive }) => (isActive ? "nav-active" : "nav-inactive")}
            >
              Tasks
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/workplan"
              className={({ isActive }) => (isActive ? "nav-active" : "nav-inactive")}
            >
              workplan
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
