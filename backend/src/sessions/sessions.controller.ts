import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // I need to make sure this exist or use the existing strategy

@Controller('sessions')
export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Body('title') title: string, @Request() req) {
        return this.sessionsService.create(title, req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/invite')
    async invite(@Param('id') sessionId: string, @Body('userId') userId: string) {
        return this.sessionsService.inviteUser(sessionId, userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my-sessions')
    async getMySessions(@Request() req) {
        return this.sessionsService.findForUser(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getAll() {
        return this.sessionsService.findAll();
    }
}
