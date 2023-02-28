import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signin(dto: AuthDto) {
    // find the user in the db by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // if the user is not found, throw an error
    if (!user) throw new ForbiddenException('Invalid credentials');

    // compare the password with the hash
    const pwMatches = await argon.verify(user.hash, dto.password);

    // if the password is not valid, throw an error
    if (!pwMatches) throw new ForbiddenException('Invalid credentials');

    //send back the jwt token
    return this.signToken(user.id, user.email);
  }

  async signup(dto: AuthDto) {
    try {
      // generate the password hash
      const hash = await argon.hash(dto.password);

      // save the new user to the db
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash,
        },
      });

      //send back the jwt token
      return this.signToken(user.id, user.email);
    } catch (error) {
      console.log('error ', error);
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
      }
      throw error;
    }
  }

  async signToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = { sub: userId, email };

    const token = await this.jwt.signAsync(payload);

    return { access_token: token };
  }
}
