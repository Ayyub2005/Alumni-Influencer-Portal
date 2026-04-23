# Phantasmagoria Dashboard (Coursework 2)

This folder contains a completely independent web application. While Coursework 1 handles all the complicated database storage and user profiles this dashboard simply asks Coursework 1 for the analytical data so it can draw visually appealing statistics charts for the university staff. 

## 1. Important Architecture Explained

It is incredibly important to understand that this dashboard has absolutely zero access to the main alumni data inherently. It is completely disconnected.

To make the dashboard function it relies on a very secure proxy system. When a staff member wants to look at a chart the dashboard server silently calls over to the Coursework 1 server and presents a special cryptographically secure API key. The Coursework 1 server verifies the key packages up the raw analytics figures and hands them back. 

This means you must successfully have Coursework 1 running simultaneously on port 3000 for this dashboard on port 3001 to actually work.

## 2. Step by Step Setup Guide

First you need to establish the local login database. Open your MySQL client and run the local `database.sql` script located in this specific folder. This generates a tiny separate database named `phantasmagoria_dashboard` that exclusively holds administrative login credentials so random people cannot view the university charts. 

Second you need to configure your environment. Turn `.env.example` into `.env` and fill out your local MySQL password and a Gmail application password for the verification emails. 

Third you absolutely must generate the bridge keys. You have to open your web browser log into the Coursework 1 Developer Portal as an administrator and click the button to generate two API keys. Copy the Analytics Key and paste it onto the `CW1_ANALYTICS_KEY` line inside your dashboard `.env` file. Then copy the AR Key and paste it onto the `CW1_AR_KEY` line. 

Finally open a terminal window inside this specific CW2 folder. Type `npm install` to grab the requirements. Once it finishes type `npm start` to launch the dashboard server. 

## 3. Registration and Logging In

Go to `localhost:3001` in your browser. Just like the alumni website you have to register an account first. Fill out the registration form wait for the secure verification token to arrive in your email inbox and click the link to permanently activate your login. 

Because this application handles sensitive analytics it protects staff sessions using strict browser cookies rather than traditional web tokens. This actively stops bad actors from trying to hijack your browser tab and forge malicious requests while you are looking at the charts. 

## 4. Understanding the Charts

Once logged in you will see a large gradient overview featuring statistical cards. The system executes rapid parallel queries behind the scenes fetching every piece of data from Coursework 1 simultaneously so it never slows down the visual rendering. You can use the search bars to filter exact degrees or graduation years to see how specific subsets of the alumni population are functioning across global industries.
