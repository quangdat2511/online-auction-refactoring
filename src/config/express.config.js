import express from 'express';
import session from 'express-session';
import methodOverride from 'method-override';

export function configureExpress(app) {
  app.use('/static', express.static('public'));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(methodOverride('_method'));
  app.use(session({
    secret: 'x8w3v9p2q1r7s6t5u4z0a8b7c6d5e4f3g2h1j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }));
}
