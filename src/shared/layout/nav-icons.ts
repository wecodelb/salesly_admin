import {
  Activity, BadgeCheck, Banknote, BarChart2, Building2, CheckSquare, Coins,
  CreditCard, FileText, FolderTree, Inbox, Key, LayoutDashboard, Map, MapPin,
  MapPinned, MessageCircle, Package, Percent, RotateCcw, Route, Ruler, Settings,
  Shield, ShoppingCart, Tag, Tags, Trophy, Truck, UserCog, Warehouse,
  type LucideIcon,
} from 'lucide-react'

/**
 * Every icon the menu can name.
 *
 * Kept beside nav-config rather than in the component, because it is the other
 * half of the same table — and because a test can then hold the two against
 * each other. The sidebar renders `{Icon && <Icon />}`, so an item naming an
 * icon that is not in here does not fail: it renders with none, and the label
 * sits alone, out of line with every other row, with nothing anywhere saying
 * why. Load Requests shipped like that.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Activity, BadgeCheck, Banknote, BarChart2, Building2, CheckSquare, Coins,
  CreditCard, FileText, FolderTree, Inbox, Key, LayoutDashboard, Map, MapPin,
  MapPinned, MessageCircle, Package, Percent, RotateCcw, Route, Ruler, Settings,
  Shield, ShoppingCart, Tag, Tags, Trophy, Truck, UserCog, Warehouse,
}
