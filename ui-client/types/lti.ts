export interface User {
  name: string;
  email: string;
  roles: string[];
  context: {
    context: {
      id: string;
      title: string;
    };
  };
}

export interface Assessment {
  _id?: string;
  id?: string;
  assessmentId?: string;
  assessmentTitle: string;
  totalCandidates: number;
  totalInvited: number;
  created: string;
  createdBy: string;
}

export interface Student {
  user_id: string;
  name: string;
  email: string;
  roles?: string[];
}
