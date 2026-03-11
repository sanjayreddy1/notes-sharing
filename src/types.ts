import { LucideIcon } from 'lucide-react';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  college: string;
  academic_details: string;
  is_verified: number;
}

export interface Material {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  subject: string;
  description: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  id: string;
}
