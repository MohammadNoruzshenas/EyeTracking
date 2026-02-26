import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { SessionsGateway } from './sessions.gateway';

@Injectable()
export class SessionsService {
    constructor(
        @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
        @Inject(forwardRef(() => SessionsGateway))
        private readonly sessionsGateway: SessionsGateway,
    ) { }

    async create(title: string, adminId: string): Promise<SessionDocument> {
        const session = new this.sessionModel({
            title,
            admin: adminId,
            invitees: [],
        });
        return session.save();
    }

    async inviteUser(sessionId: string, userId: string) {
        const session = await this.sessionModel.findById(sessionId);
        if (!session) throw new NotFoundException('Session not found');

        // Check if already invited
        const isAlreadyInvited = session.invitees.some(inv => inv.user.toString() === userId);
        if (!isAlreadyInvited) {
            session.invitees.push({ user: userId, status: 'invited' } as any);
            await session.save();
        }

        // Populate user info for notification
        const populatedSession = await this.sessionModel.findById(sessionId).populate('admin', 'email').exec();

        // Notify via WebSocket
        this.sessionsGateway.notifyInvitation(userId, populatedSession);

        return session;
    }

    async findForUser(userId: string) {
        return this.sessionModel.find({
            $or: [
                { admin: userId },
                { 'invitees.user': userId }
            ]
        } as any).populate('admin', 'email').sort({ createdAt: -1 }).exec();
    }

    async findAll() {
        return this.sessionModel.find().populate('admin', 'email').sort({ createdAt: -1 }).exec();
    }

    async finishSession(sessionId: string, results: any) {
        return this.sessionModel.findByIdAndUpdate(
            sessionId,
            { status: 'completed', results },
            { new: true }
        ).populate('admin', 'email').exec();
    }
}
