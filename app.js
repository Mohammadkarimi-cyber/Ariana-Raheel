// *****  REQUIRING ALL MODULES  *****
const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const path = require('path');
const _ = require('lodash');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const https = require('https');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const compression = require('compression');

// *****  REQUIRING DATA FILE  *****
const data = require('./data.js');

// *****  SETTING UP PAYMENT  *****
const razorpay = new Razorpay({
    key_id: process.env.KEY_ID,
    key_secret: process.env.KEY_SECRET
});

const app = express();

// *****  MIDDLEWARE SETUPS  *****
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
// *****  DATA COMPRESSION - FAST LOADING  *****
app.use(compression({
    level: 6,
    threshold: 0
}));

// *****  DATABASE SETUP  *****
mongoose.connect(process.env.DB_URL);
const paymentSchema = new mongoose.Schema({
    id: String,
    amount: Number,
    currency: String,
    status: String,
    order_id: String,
    method: String,
    card_id: String,
    email: String,
    contact: String,
    fee: Number,
    tax: Number,
    created_at: Number
});
const Payment = mongoose.model('Payment', paymentSchema);

// *****  MAKING ALL ROUTES  *****
// HOME ROUTE / GET
app.get('/', (req, res) => {
    res.render('home', {
        details: data.specialToursCards
    });
});

// TOURS ROUTE / GET
app.get('/tours', (req, res) => {
    res.render('tours', {
        details: data.cardDetails,
        detailsTwo: data.cardDetailsTwo
    });
});

// INDIVIDUAL CITY ROUTE / DYNAMIC / GET
app.get('/tours/:cityName', (req, res) => {
    const requestedCity = _.lowerCase(req.params.cityName);
    
    const cities = data.citiesDetails;
    const dayOfWeek = data.dayOfWeek;

    // storing API data to variables.
    const apiKey = process.env.API_KEY;
    const city = requestedCity;
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' + city + '&units=metric&appid=' + apiKey;

    // making request to weather API server.
    https.get(url, (response) => {
        response.on("data", (data) => {
            // parsing API data and storing data that we need.
            const weatherData = JSON.parse(data);
            
            // STORING WEATHER DATA INTO AN OBJECT
            var weather = {
                day: dayOfWeek,
                temp: weatherData.main.temp,
                description: weatherData.weather[0].description,
                feelsLike: weatherData.main.feels_like
            };

            cities.forEach((city) => {
                const allCities = _.lowerCase(city.cityName);
        
                if(allCities === requestedCity) {
                    cityPrice = city.price;
                    res.render('city', {
                        cityName: city.cityName,
                        cityGeneralData: city.cityGeneralData,
                        photo: city.photo,
                        weather
                    });
                }
            });
        });
    });
});

// CONTACT ROUTE / POST
app.post('/contact', (req, res) => {
    const name = req.body.fullName;
    const email = req.body.email;
    const msg = req.body.msg;

    const output = `
        <p>You have a new contact request</p>
        <h3>Contact Details</h3>
        <ul>
            <li>Name: ${ name }</li>
            <li>Email: ${ email }</li>
        </ul>
        <h3>Message</h3>
            <p>${ msg }</p>
    `;

    let transporter = nodemailer.createTransport(smtpTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.CONTACT_EMAIL,
          pass: process.env.CONTACT_EMAIL_PASS
        }
    }));
    
    // send mail with defined transport object
    let mailOptions = {
        from: process.env.CONTACT_EMAIL,
        to: process.env.ARIANA_RAHEEL_EMAIL,
        subject: `New email from ${name}`,
        text: 'hello world!',
        html: output
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if(error) {
            return console.log(error);
        }
        res.render('contact-success');
    });
});

// PAYMENT ROUTE / POST
app.post('/order', (req, res) => {
    let options = {
        amount: 79900,
        currency: 'USD',
        method: 'card'
    }
    razorpay.orders.create(options, (err, order) => {
        res.json(order);
    });
});

app.post('/payment/details', (req, res) => {
    razorpay.payments.fetch(req.body.razorpay_payment_id).then((paymentDocs) => {
        const paymentDataForDB = new Payment({
            id: paymentDocs.id,
            amount: paymentDocs.amount,
            currency: paymentDocs.currency,
            status: paymentDocs.status,
            order_id: paymentDocs.order_id,
            method: paymentDocs.method,
            card_id: paymentDocs.card_id,
            email: paymentDocs.email,
            contact: paymentDocs.contact,
            fee: paymentDocs.fee,
            tax: paymentDocs.tax,
            created_at: paymentDocs.created_at
        });
        paymentDataForDB.save();

        if(paymentDocs.status === 'captured') {
            res.render('payment-success', {
                paymentData: paymentDocs
            });
        } else {
            res.render('payment-failure');
        }
    });
    
});

app.get('/payment/fail', (req, res) => {
    res.render('payment-failure');
});

// *****  404 PAGE NOT FOUNT ROUTE  *****
app.use((req, res) => {
    res.status(404).render('page404');
});

// *****  SETTING PORT NUMBER AND STARTING SERVER  *****
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('Server is running on port: ' + port);
});