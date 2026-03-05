import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

const Breadcrumbs = ({ items = [] }) => {
  const location = useLocation();

  // If items are provided, use them. Otherwise, try to generate from path.
  // For now, let's stick to explicit items to ensure correctness as the path might be complex.
  const breadcrumbItems = items.length > 0 ? items : [];

  return (
    <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2" aria-label="Breadcrumb">
      <Link
        to="/"
        className="flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={index}>
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-slate-400" />
            {item.path ? (
              <Link
                to={item.path}
                className="text-slate-500 hover:text-teal-600 transition-colors capitalize"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-700 font-medium capitalize">
                {item.label}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
