export interface IUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  userId: string; // Links to user's accounts in mockAccounts
}

export class User implements IUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  userId: string;

  constructor(data: IUser) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.balance = data.balance;
    this.userId = data.userId;
  }
}
