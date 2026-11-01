export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pushToken?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SignIn = { identifier: string; password: string };
export type SignUp = { name: string; email?: string; phone?: string; password: string };
export type Join = { code: string; password: string; phone?: string };

/** Lo que revela un código de invitación antes de usarlo. */
export type InvitationPreview = { farmName: string; nombre: string; rol: string };
