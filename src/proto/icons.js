// One place mapping the preview's icon names to react-icons/fi — the icon set already used
// everywhere else in this app (confirmed in Orders.js, Sidebar.js, etc).
import {
  FiList, FiBox, FiBarChart2, FiCpu, FiCheckCircle, FiRefreshCw, FiSliders, FiSettings,
  FiSearch, FiArrowLeft, FiFileText, FiInfo, FiPlus, FiCalendar, FiX, FiUsers, FiDownload, FiUpload,
} from 'react-icons/fi';

export const ICONS = {
  base: FiList,
  part: FiBox,
  board: FiBarChart2,
  cam: FiCpu,
  quality: FiCheckCircle,
  knowledge: FiRefreshCw,
  factory: FiSliders,
  settings: FiSettings,
  search: FiSearch,
  back: FiArrowLeft,
  doc: FiFileText,
  cad: FiBox,
  box: FiBox,
  info: FiInfo,
  plus: FiPlus,
  calendar: FiCalendar,
  close: FiX,
  users: FiUsers,
  download: FiDownload,
  upload: FiUpload,
};

export default function Icon({ name, size = 18 }) {
  const Cmp = ICONS[name] || FiInfo;
  return <Cmp size={size} className="icon" />;
}
