from database import db
from datetime import datetime


class Note(db.Model):
    __tablename__ = "notes"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False, default="")
    summary = db.Column(db.Text, nullable=True)
    analyzed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    concepts = db.relationship("Concept", backref="note", lazy=True, cascade="all, delete-orphan")
    outgoing_links = db.relationship(
        "NoteLink",
        foreign_keys="NoteLink.source_id",
        backref="source",
        lazy=True,
        cascade="all, delete-orphan",
    )
    incoming_links = db.relationship(
        "NoteLink",
        foreign_keys="NoteLink.target_id",
        backref="target",
        lazy=True,
    )

    def to_dict(self, include_content=True):
        d = {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "analyzed": self.analyzed,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "concepts": [c.to_dict() for c in self.concepts],
            "link_count": len(self.outgoing_links) + len(self.incoming_links),
        }
        if include_content:
            d["content"] = self.content
        return d


class Concept(db.Model):
    __tablename__ = "concepts"

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey("notes.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "category": self.category}


class NoteLink(db.Model):
    __tablename__ = "note_links"

    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(db.Integer, db.ForeignKey("notes.id"), nullable=False)
    target_id = db.Column(db.Integer, db.ForeignKey("notes.id"), nullable=False)
    relationship = db.Column(db.String(300), nullable=False)
    strength = db.Column(db.Float, default=0.5)

    def to_dict(self):
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "relationship": self.relationship,
            "strength": self.strength,
        }


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
        }
