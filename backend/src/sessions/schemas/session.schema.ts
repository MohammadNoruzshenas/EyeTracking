import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
    @Prop({ required: true })
    title: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    admin: User;

    @Prop([{
        user: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['invited', 'joined'], default: 'invited' }
    }])
    invitees: { user: User | string; status: string }[];

    @Prop({ default: 'active', enum: ['active', 'completed'] })
    status: string;

    @Prop([{
        imageUrl: String,
        gazePoints: [{ x: Number, y: Number, timestamp: { type: Date, default: Date.now } }]
    }])
    results: { imageUrl: string; gazePoints: { x: number; y: number; timestamp: Date }[] }[];
}

export const SessionSchema = SchemaFactory.createForClass(Session);
