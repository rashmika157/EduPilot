from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config import settings

# Create database engine
# pool_pre_ping=True checks connection health before issuing queries
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    print(f"Error initializing MySQL engine: {e}")
    # We will let init_db.py handle initial DB provisioning
    SessionLocal = None

Base = declarative_base()

def get_db():
    if SessionLocal is None:
        raise Exception("Database session could not be initialized. Please check MySQL settings.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
