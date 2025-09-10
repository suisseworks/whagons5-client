import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

function Statuses() {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/settings');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button 
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground hover:underline transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>{'>'}</span>
          <span className="text-foreground">Statuses</span>
        </nav>
      </div>
    </div>
  );
}

export default Statuses;



