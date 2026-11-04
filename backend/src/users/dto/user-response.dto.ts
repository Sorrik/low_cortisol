export class UserResponseDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  dateOfBirth!: Date | null;
  isActive!: boolean;
  createdAt!: Date;
}
