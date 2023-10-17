const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Database
const connectDatabase = require('./database/connectDatabase');
const categoryModel = require('./database/categoryModel');
const areaModel = require('./database/areaModel');
const complainantModel = require('./database/complainantModel');
const otpModel = require('./database/otpModel');
const complaintModel = require('./database/complaintModel');
const complaintHandlerModel = require('./database/complaintHandlerModel');

// Token
const verifyToken = require('./token/verifyToken');
const createToken = require('./token/createToken');

// Mailer
const transporter = require('./mailer/transporter');

const app = express();

connectDatabase();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.post('/registersendotp', (req, res) => {
    const emailAddress = req.body.emailAddress;
    const name = req.body.name;
    console.log('verify email', emailAddress, name);

    if (emailAddress === undefined) {
        console.log('verify email: No email');
        res.status(400).json({
            message: 'No email'
        });
        return;
    }

    complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
        if (result != null){
            console.log('verify email: User already exists');
            res.status(400).json({
                message: "User already exists"
            });
            return;
        }

        var otp = '';
        for (var i=0; i<6; i++) {
            var randomNumber = Math.floor(Math.random() * 10);
            randomNumber = randomNumber.toString();
            otp += randomNumber;
        }
        console.log('otp', otp);

        const mailOptions = {
            from: 'chankhaishen36@gmail.com',
            to: emailAddress,
            subject: 'Email Verification',
            html: `
                <p>Hi ${name},</p>
                <p/>
                <p>To verify your email address, please enter the following OTP on the registration page.<p/>
                <p/>
                <h4>${otp}</h4>
                <p/>
                <p>Regards,</p>
                <p>City Complaint System</p>
            `
        }

        transporter.sendMail(mailOptions, async function(error, info) {
            if (error != null) {
                console.log('send otp error', error);
                res.status(500).send();
                return;
            }

            console.log('send otp success', info.response);

            const Otp = new otpModel({
                emailAddress: emailAddress,
                otp: otp
            });
        
            await Otp.save().then(response=>{
                console.log('Otp success save', response);
                res.status(200).json({
                    message: "OTP was sent to the email"
                });

            }).catch(error=>{
                console.log('Otp error save', error);
                res.status(500).send();
            });
        });

    }).catch(error=>{
        console.log('verify email error check', error);
        res.status(500).send();
    });
})

app.post('/register', (req, res) => {
    const emailAddress = req.body.emailAddress;
    const password = req.body.password;
    const name = req.body.name;
    const IC_Number = req.body.IC_Number;
    const mobilePhoneNumber = req.body.mobilePhoneNumber;
    const homeAddress = req.body.homeAddress;
    const faxNumber = req.body.faxNumber;
    const otp = req.body.otp;
    console.log('register', emailAddress, password, name, IC_Number, mobilePhoneNumber, homeAddress, faxNumber, otp);

    if (emailAddress === undefined || password === undefined || name === undefined || IC_Number === undefined || mobilePhoneNumber === undefined || otp === undefined) {
        console.log('register: Mandatory field missing');
        res.status(400).json({
            message: "Some mandatory field is missing"
        });
        return;
    }

    otpModel.find({emailAddress: emailAddress}).sort({'created': 'descending'}).then(result=>{
        if (result == null){
            console.log('register: No otp');
            res.status(400).json({
                message: "Email verification fail"
            });
            return;
        }

        if (otp !== result[0].otp) {
            console.log('register: wrong otp');
            res.status(400).json({
                message: "Email verification fail"
            });
            return;
        }
        
        complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
            if (result != null){
                console.log('register: User already exists');
                res.status(400).json({
                    message: "User already exists"
                });
                return;
            }

            const complainant = new complainantModel({
                emailAddress: emailAddress,
                password: password,
                name: name,
                IC_Number: IC_Number,
                mobilePhoneNumber: mobilePhoneNumber,
                homeAddress: homeAddress,
                faxNumber: faxNumber
            });
            
            complainant.save().then(response=>{
                console.log('Register success save', response);
                res.status(200).json({
                    message: "Registered"
                });
    
            }).catch(error=>{
                console.log('register error save', error);
                res.status(500).send();
            });

        }).catch(error=>{
            console.log('register error check', error);
            res.status(500).send();
        });

    }).catch(error=>{
        console.log('register error check otp', error);
        res.status(500).send();
    });
});

app.post('/login', (req, res)=>{
    const emailAddress = req.body.emailAddress;
    const password = req.body.password;
    console.log('Login', emailAddress, password);

    if (emailAddress === undefined || password === undefined){
        console.log('Login: No credential');
        res.status(400).json({
            message: "No credential"
        });
        return;
    }

    // Complainant
    complainantModel.findOne({emailAddress: emailAddress}).then(async result=>{
        console.log('Login success find complainant', result);
        
        if (result === null){
            // Complaint handler
            complaintHandlerModel.findOne({emailAddress: emailAddress}.then(result=>{
                console.log('Login: success find complaint handler', error);
                
                if (result === null){
                    console.log('Login: Email wrong');
                    res.status(401).json({
                        message: "Email address and password not match"
                    });
                    return;
                }

                if (password !== result.password){
                    console.log('Login: Password wrong');
                    res.status(401).json({
                        message: "Email address and password not match"
                    });
                    return;
                }
        
                const token = createToken(
                    {
                        emailAddress: result.emailAddress,
                        name: result.name,
                        role: result.role
                    }
                );
        
                res.status(200).json({
                    message: "Logged in",
                    user: {
                        emailAddress: result.emailAddress,
                        name: result.name,
                        role: result.role,
                        token: token
                    },
                });
            })).catch(error=>{
                console.log('Login error: find complaint handler', error);
                return null;
            });
        }

        if (password !== result.password){
            console.log('Login: Password wrong');
            res.status(401).json({
                message: "Email address and password not match"
            });
            return;
        }

        const token = createToken(
            {
                emailAddress: result.emailAddress,
                name: result.name,
                role: "complainant"
            }
        );

        res.status(200).json({
            message: "Logged in",
            user: {
                emailAddress: result.emailAddress,
                name: result.name,
                role: "complainant",
                token: token
            },
        });

    }).catch(error=>{
        console.log('Login error: find complainant', error);
        res.status(500).send();
    })
});

app.get('/allcategories', verifyToken, (req, res)=>{
    const user = req.user;
    console.log('get categories', user);

    categoryModel.find({}).then(results=>{
        console.log('categories: ' + results);

        const categories = [];
        for (var i=0; i<results.length; i++){
            if (user.role === 'complainant')
                categories.push({
                    id: results[i]._id,
                    name: results[i].name
                });
            else {
                categories.push({
                    id: results[i]._id,
                    name: results[i].name,
                    createdBy: results[i].createdByName,
                    created: results[i].created
                });
            }
        }

        res.status(200).json({
            categories: categories
        });
    }).catch(error=>{
        console.log('categories', error);
        res.status(500).send();
    });
});

app.get('/allareas', verifyToken, (req, res)=>{
    const user = req.user;
    console.log('get areas', user);

    areaModel.find({}).then(results=>{
        console.log('areas: ' + results);

        const areas = [];
        for (var i=0; i<results.length; i++){
            if (user.role === 'complainant')
                areas.push({
                    id: results[i]._id,
                    name: results[i].name
                });
            else
                areas.push({
                    id: results[i]._id,
                    name: results[i].name,
                    createdBy: results[i].createdByName,
                    created: results[i].created
                });
        }

        res.status(200).json({
            areas: areas
        });
    }).catch(error=>{
        console.log('areas', error);
        res.status(500).send();
    });
});

app.post('/lodgecomplaint', verifyToken, (req, res)=>{
    const title = req.body.title;
    const category = req.body.category;
    const description = req.body.description;
    const expectedResult = req.body.expectedResult;
    const area = req.body.area;
    const incidentAddress = req.body.incidentAddress;
    const emailAddress = req.user.emailAddress;
    const name = req.user.name;
    console.log('lodge complaint', title, category, description, expectedResult, area, incidentAddress, emailAddress, name);

    if (req.user.role !== 'complainant') {
        console.log('lodge complaint: Not complainant');
        res.status(403).json({
            message: 'Your role is not complainant'
        });
        return;
    }

    if (title === undefined || category === undefined || description === undefined || area === undefined) {
        console.log('lodge complaint: Mandatory field missing');
        res.status(400).json({
            message: 'Mandatory field missing'
        });
        return;
    }
    
    const complaint = new complaintModel({
        complainantEmail: emailAddress,
        complainantName: name,
        title: title,
        category: category,
        description: description,
        expectedResult: expectedResult,
        area: area,
        incidentAddress: incidentAddress
    });

    complaint.save().then(async response=>{
        console.log('complaint success save', response);

        mailOptions = {
            from: 'chankhaishen36@gmail.com',
            to: emailAddress,
            subject: `Complaint Received (${response._id})`,
            html: `
                <p>Hi ${name},</p>
                <p/>
                <p>Your complaint has beed received. The following are the details of the complaint case that we received.<p/>
                <p/>
                <section style="border-style: groove; padding: 20px;">
                    <h3>Title: ${response.title}</h3>
                    <p>Case ID: ${response._id}</p>
                    <p>Status: ${response.status}</p>
                    <p>Date: ${(new Date(response.created)).toDateString()}</p>
                    <p/>
                    <h3>Details:</h3>
                    <p>Category: ${response.category}</p>
                    <p>Description: ${response.description}</p>
                    <p>Expected Result: ${response.expectedResult == null || response.expectedResult === '' ? 'Not Available' : response.expectedResult}</p>
                    <p>Area: ${response.area}</p>
                    <p>Incident Address: ${response.incidentAddress == null || response.incidentAddress === '' ? 'Not Available' : response.incidentAddress}</p>
                    <p/>
                </section>
                <p>Regards,</p>
                <p>City Complaint System</p>
            `
        }

        transporter.sendMail(mailOptions, function(error, info) {
            if (error != null) {
                console.log('send receipt email error', error);
            } else {
                console.log('send receipt email', info.response);  
            }
            res.status(201).json({
                message: 'Received',
                received: {
                    title: response.title,
                    caseId: response._id,
                    status: response.status,
                    date: (new Date(response.created)).toDateString(),
                    category: response.category,
                    description: response.description,
                    expectedResult: response.expectedResult == null || response.expectedResult === '' ? 'Not Available' : response.expectedResult,
                    area: response.area,
                    incidentAddress: response.incidentAddress == null || response.incidentAddress === '' ? 'Not Available' : response.incidentAddress
                }
            });
        });
    }).catch(error=>{
        console.log('complaint error save', error);
        res.status(500).send();
    });
});

app.listen(5000, ()=>
{
    console.log('Listening from port 5000.')
});
