export interface JwtPayload {
  userId: string;
  email: string;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
