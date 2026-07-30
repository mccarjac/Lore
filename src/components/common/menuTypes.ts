export interface MenuItem {
  label: string;
  onPress: () => void;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}
