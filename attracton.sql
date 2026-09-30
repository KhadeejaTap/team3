create table ATTRACTION (
    attr_ID int PRIMARY KEY,
    name varchar(100),
    type varchar(30),
    location varchar(40),
    attr_datetime date,
    description varchar(500),
);

create table ATTR_ANIMAL(
    attr_animal_ID int PRIMARY KEY,
    animal_ID int not null,
    attr_ID int not null,

    FOREIGN KEY (animal_ID) REFERENCES ANIMAL (animal_ID),
    FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);

create table ATTR_TICKET(
    ticket_ID int not null,
    attr_ID int not null,

    FOREIGN KEY (ticket_ID) REFERENCES TICKET (ticket_ID),
    FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);