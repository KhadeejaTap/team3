create table VISITOR(
    visitor_ID int PRIMARY KEY,
    ticket_ID int not null,
    name varchar(100),
    age int,
    email  varchar(100),
    phone  varchar(20),
    membership boolean default FALSE,
    

    FOREIGN KEY(ticket_ID) REFERENCES TICKET(ticket_ID)
);
   