export interface Group {
    id: number;
    name: string;
}

export interface Participant {
    id: number;
    name: string;
    groupId: number;
}