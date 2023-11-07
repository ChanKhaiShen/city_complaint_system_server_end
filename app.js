const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

require('dotenv').config();

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
const { default: mongoose } = require('mongoose');
const { result } = require('safe/lib/safe');

const app = express();

connectDatabase();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.post('/sendotp/:option', async (req, res) => {
    const emailAddress = req.body.emailAddress;
    const option = req.params.option;
    console.log('send otp', emailAddress, option);

    if (emailAddress === undefined) {
        console.log('send otp: No email');
        res.status(400).json({
            message: 'No email'
        });
        return;
    }

    var name;
    if (option === 'register') {
        name = req.body.name;
        if (name === undefined) {
            console.log('send otp: No name');
            res.status(400).json({
                message: 'No name'
            });
            return;
        }
    }
    else if (option === 'setpassword') {
        const promise = new Promise((resolve, reject)=>{
            complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
                console.log('send otp: find complainant name', result);
                if (result != null) {
                    name = result.name;
                    resolve();
                    return;
                }
        
                complaintHandlerModel.findOne({emailAddress: emailAddress}).then(response=>{
                    console.log('send otp: find complaint handler name', response);
                    if (response != null)
                        name = response.name;
                    resolve();
                }).catch(error=>{
                    console.log('send otp: find complaint handler name error', error);
                    resolve();
                });
            }).catch(error=>{
                console.log('send otp: find complainant name error', error);
                resolve();
            });
        });
        
        await promise;
        
        if (name == null) {
            res.status(400).json({
                message: 'Email address not found'
            });
            return;
        }
    }
    else {
        res.status(400).json({
            message: 'Not a valid option'
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
        from: process.env.MAILER_USER,
        to: emailAddress,
        subject: 'Email Verification',
        html: `
            <p>Hi ${name.trim()},</p>
            <p/>
            <p>To verify your email address, please enter the following OTP.<p/>
            <p/>
            <h4>${otp}</h4>
            <p/>
            <p>Regards,</p>
            <p>City Complaint System</p>
        `
    }

    transporter.sendMail(mailOptions, function(error, info) {
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
        
        Otp.save().then(response=>{
            console.log('Otp success save', response);
            res.status(200).json({
                message: "OTP was sent to the email"
            });

        }).catch(error=>{
            console.log('Otp error save', error);
            res.status(500).send();
        });
    });
});

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
        
        otpModel.deleteMany({emailAddress: emailAddress}).then(response=>{  // Otp will be deleted after verified
            console.log('register: delete otp', response);

            complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
                if (result != null){
                    console.log('register: User already exists');
                    res.status(400).json({
                        message: "User already exists"
                    });
                    return;
                }
    
                complaintHandlerModel.findOne({emailAddress: emailAddress}).then(result=>{
                    if (result != null){
                        console.log('register: User already exists');
                        res.status(400).json({
                            message: "User already exists"
                        });
                        return;
                    }

                    const salt = crypto.randomBytes(16).toString('base64');

                    crypto.pbkdf2(password, salt, 100, 256, 'sha-256', (err, derivedKey)=>{
                        if (err != null) {
                            console.log('register: hash password error', err);
                            res.status(500).send();
                            return;
                        }

                        const hashedPassword = derivedKey.toString('base64');

                        const complainant = new complainantModel({
                            emailAddress: emailAddress,
                            password: hashedPassword,
                            salt: salt,
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
                    });

                }).catch(error=>{
                    console.log('register error check complaint handler', error);
                    res.status(500).send();
                });
            }).catch(error=>{
                console.log('register error check complainant', error);
                res.status(500).send();
            });
        }).catch(error=>{
            console.log('register error delete otp', error);
            res.status(500).send();
        });

    }).catch(error=>{
        console.log('register error check otp', error);
        res.status(500).send();
    });
});

app.post('/setpassword', (req, res)=>{
    const emailAddress = req.body.emailAddress;
    const password = req.body.password;
    const otp = req.body.otp;

    console.log('set password', emailAddress, password, otp);

    if (emailAddress === undefined || password === undefined || otp === undefined) {
        console.log('set password: Mandatory field missing');
        res.status(400).json({
            message: "Some mandatory field is missing"
        });
        return;
    }

    otpModel.find({emailAddress: emailAddress}).sort({'created': 'descending'}).then(result=>{
        if (result == null){
            console.log('set password: No otp');
            res.status(400).json({
                message: "Email verification fail"
            });
            return;
        }

        if (otp !== result[0].otp) {
            console.log('set password: wrong otp');
            res.status(400).json({
                message: "Email verification fail"
            });
            return;
        }
        
        otpModel.deleteMany({emailAddress: emailAddress}).then(response=>{
            console.log('set password: delete otp', response);

            complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
                if (result != null){
                    console.log('set password: Complainant found');

                    const salt = crypto.randomBytes(16).toString('base64');

                    crypto.pbkdf2(password, salt, 100, 256, 'sha-256', (err, derivedKey)=>{
                        if (err != null) {
                            console.log('set password: hash password error', err);
                            res.status(500).send();
                            return;
                        }

                        const hashedPassword = derivedKey.toString('base64');

                        complainantModel.updateOne({emailAddress: emailAddress}, {password: hashedPassword, salt: salt}).then(result=>{
                            console.log('set complainant password', result);
                            res.status(200).json({
                                message: "Set password done"
                            });
                        }).catch(error=>{
                            console.log('set complainant password error', error);
                            res.status(500).send();
                        });
                    });

                    return;
                }
    
                console.log('set password: Complainant not found');
                complaintHandlerModel.findOne({emailAddress: emailAddress}).then(result=>{
                    if (result === null){
                        console.log('set password: User not exist');
                        res.status(400).json({
                            message: "User not exist"
                        });
                        return;
                    }

                    console.log('set password: Complaint handler found');

                    const salt = crypto.randomBytes(16).toString('base64');

                    crypto.pbkdf2(password, salt, 100, 256, 'sha-256', (err, derivedKey)=>{
                        if (err != null) {
                            console.log('set password: hash password error', err);
                            res.status(500).send();
                            return;
                        }

                        const hashedPassword = derivedKey.toString('base64');

                        complaintHandlerModel.updateOne({emailAddress: emailAddress}, {password: hashedPassword, salt: salt}).then(response=>{
                            console.log('set complaint handler password', result);
                            res.status(200).json({
                                message: "Set password done"
                            });
                        }).catch(error=>{
                            console.log('set complaint handler password error', error);
                            res.status(500).send();
                        });
                    });

                }).catch(error=>{
                    console.log('set password error check complaint handler', error);
                    res.status(500).send();
                });
            }).catch(error=>{
                console.log('set password error check complainant', error);
                res.status(500).send();
            });
        }).catch(error=>{
            console.log('set password error delete otp', error);
            res.status(500).send();
        });

    }).catch(error=>{
        console.log('set password error check otp', error);
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

    complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
        console.log('Login success find complainant', result);
        
        if (result === null){   // If null, then check complaint handler
            complaintHandlerModel.findOne({emailAddress: emailAddress}).then(result=>{
                console.log('Login: success find complaint handler', result);
                
                if (result === null){
                    console.log('Login: Not found');
                    res.status(401).json({
                        message: "Email address and password not match"
                    });
                    return;
                }

                crypto.pbkdf2(password, result.salt, 100, 256, 'sha-256', (err, derivedKey)=>{
                    if (err != null) {
                        console.log('Login: hash password error', err);
                        res.status(500).send();
                        return;
                    }
    
                    const hashedPassword = derivedKey.toString('base64');

                    if (hashedPassword !== result.password) {
                        console.log('Login: Wrong password');
                        res.status(401).json({
                            message: 'Email address and password not match'
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
                });
            }).catch(error=>{
                console.log('Login error: find complaint handler', error);
                res.status(500).send();
                return;
            });
        }
        else {  // If not null, then user is complainant
            crypto.pbkdf2(password, result.salt, 100, 256, 'sha-256', (err, derivedKey)=>{
                if (err != null) {
                    console.log('Login: hash password error', err);
                    res.status(500).send();
                    return;
                }

                const hashedPassword = derivedKey.toString('base64');
                
                if (hashedPassword !== result.password) {
                    console.log('Login: Wrong password');
                    res.status(401).json({
                        message: 'Email address and password not match'
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

            });
        }
    }).catch(error=>{
        console.log('Login error: find complainant', error);
        res.status(500).send();
    });
});

app.get('/verifytoken', verifyToken, (req, res)=>{   // The purpose is for the front end program to check whether the token stored is expired or not
    if (req.user != null) {
        console.log('verify token: Verified');
        res.status(200).send();
    }
    else {
        console.log('verify token: Not verified');
        res.status(401).send();
    }
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
                    creatorEmail: results[i].creatorEmail,
                    creatorName: results[i].creatorName,
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
                    creatorEmail: results[i].creatorEmail,
                    creatorName: results[i].creatorName,
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

app.post('/addcategory', verifyToken, (req, res)=>{
    const user = req.user;
    const categoryName = req.body.name;
    console.log('add category', categoryName, user);

    if (user.role !== 'administrator') {
        console.log('add category: Not administrator');
        res.status(403).send();
        return;
    }

    if (categoryName == null) {
        console.log('add category: No category name');
        res.status(400).json({
            message: 'Must have category name'
        });
        return;
    }

    categoryModel.findOne({name: categoryName}).then(result=>{
        console.log('add category find exist', result);
        
        if (result != null) {
            console.log('add category: Exist');
            res.status(400).json({
                message: 'Category already exists'
            });
            return;
        }
        
        const category = new categoryModel({
            name: categoryName,
            creatorEmail: user.emailAddress,
            creatorName: user.name
        });

        category.save().then(result=>{
            console.log('add category save', result);
            res.status(201).json({
                message: 'Added',
                category: {
                    id: result._id,
                    name: result.name,
                    creatorEmail: result.creatorEmail,
                    creatorName: result.creatorName,
                    created: result.created
                }
            });
        }).catch(error=>{
            console.log('add category save', error);
            res.status(500).send();
        });
    }).catch(error=>{
        console.log('add category find exist', error);
        res.status(500).send();
    });
});

app.post('/addarea', verifyToken, (req, res)=>{
    const user = req.user;
    const areaName = req.body.name;
    console.log('add area', areaName, user);

    if (user.role !== 'administrator') {
        console.log('add area: Not administrator');
        res.status(403).send();
        return;
    }

    if (areaName == null) {
        console.log('add area: No area name');
        res.status(400).json({
            message: 'Must have area name'
        });
        return;
    }

    areaModel.findOne({name: areaName}).then(result=>{
        console.log('add area find exist', result);
        
        if (result != null) {
            console.log('add area: Exist');
            res.status(400).json({
                message: 'Area already exists'
            });
            return;
        }
            
            const area = new areaModel({
                name: areaName,
                creatorEmail: user.emailAddress,
                creatorName: user.name
            });
    
            area.save().then(result=>{
                console.log('add area save', result);
                res.status(201).json({
                    message: 'Added',
                    area: {
                        id: result._id,
                        name: result.name,
                        creatorEmail: result.creatorEmail,
                        creatorName: result.creatorName,
                        created: result.created
                    }
                });
            }).catch(error=>{
                console.log('add area save', error);
                res.status(500).send();
            });
    }).catch(error=>{
        console.log('add area find exist', error);
        res.status(500).send();
    });
});

app.delete('/deletecategory', verifyToken, (req, res)=>{
    const user = req.user;
    const categoryName = req.query.name;
    console.log('delete category', categoryName, user);

    if (user.role !== 'administrator') {
        console.log('delete category: Not administrator');
        res.status(403).send();
        return;
    }

    if (categoryName == null) {
        console.log('delete category: No category name');
        res.status(400).json({
            message: 'Must have category name'
        });
        return;
    }

    categoryModel.deleteMany({name: categoryName}).then(result=>{
        console.log('delete category', result);
        res.status(204).send();
    }).catch(error=>{
        console.log('delete category error', error);
        res.status(500).send();
    });
});

app.delete('/deletearea', verifyToken, (req, res)=>{
    const user = req.user;
    const areaName = req.query.name;
    console.log('delete area', areaName, user);

    if (user.role !== 'administrator') {
        console.log('delete area: Not administrator');
        res.status(403).send();
        return;
    }

    if (areaName == null) {
        console.log('delete area: No area name');
        res.status(400).json({
            message: 'Must have area name'
        });
        return;
    }

    areaModel.deleteMany({name: areaName}).then(result=>{
        console.log('delete area', result);
        res.status(204).send();
    }).catch(error=>{
        console.log('delete area error', error);
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
        res.status(403).send();
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
        incidentAddress: incidentAddress,
        histories: [
            {
                message: 'Status is "Received".',
                from: 'System'
            }
        ]
    });

    complaint.save().then(response=>{
        console.log('complaint success save', response);

        mailOptions = {
            from: process.env.MAILER_USER,
            to: emailAddress,
            subject: `Complaint case notification (${response._id})`,
            html: `
                <p>Hi ${name.trim()},</p>
                <p/>
                <p>Your complaint has beed received. The following are the details of the complaint case that we received.<p/>
                <p/>
                <section style="border-style: groove; padding: 20px;">
                    <h3>Title: ${response.title}</h3>
                    <p>Case ID: ${response._id}</p>
                    <p>Status: ${response.status}</p>
                    <p>Date: ${(new Date(response.created)).toLocaleDateString()}</p>
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
                    date: (new Date(response.created)).toLocaleDateString(),
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

app.get('/allcomplaints', verifyToken, (req, res)=>{
    const user = req.user;
    var startDate = req.query.startdate;
    var endDate = req.query.enddate;
    const searchWord = req.query.searchword;
    console.log('get all complaints', user, startDate, endDate, searchWord);

    try {
        const regExp_Date = /^2[0-9]{3}\-[0-1][0-9]\-[0-3][0-9]$/;
        
        if (startDate != null) {
            startDate = startDate.trim();
            if (regExp_Date.test(startDate) === false) 
                throw 'Not a valid start date';
        }

        if (endDate != null) {
            endDate = endDate.trim();
            if (regExp_Date.test(endDate) === false)
                throw 'Not a valid end date';
        }
    }
    catch(error) {
        console.log('get complaint', error);
        res.status(400).json({
            message: error
        });
        return;
    }

    if (user.role === 'complainant') {
        console.log('get complaint for complainant', user.emailAddress);

        complaintModel.find({
            complainantEmail: user.emailAddress,
            $or: [
                {
                    created: {
                        $gte: startDate == null ? new Date('2023-01-01T00:00:00+08:00') : new Date(startDate + 'T00:00:00+08:00'),  // 2023-01-01 is a date when this system is not yet running
                        $lte: endDate == null ? Date.now() : new Date(endDate + 'T23:59:59+08:00')
                    }
                },
                {
                    title: searchWord == null ? '' : searchWord
                }
            ]
        }).then(results=>{
            console.log('find complaint', results);

            const complaints = [];
            for (var i = 0; i < results.length; i++) {
                const histories = [];
                
                for (var j = 0; j < results[i].histories.length; j++) {
                    if (results[i].histories[j].isInternal === false) {
                        histories.push({
                            id: results[i].histories[j]._id,
                            message: results[i].histories[j].message,
                            from: results[i].histories[j].from,
                            created: results[i].histories[j].created
                        });
                    }
                }

                complaints.push({
                    id: results[i]._id,
                    // Complaint details
                    title: results[i].title,
                    caseId: results[i]._id,
                    status: results[i].status,
                    created: results[i].created,
                    category: results[i].category,
                    description: results[i].description,
                    expectedResult: results[i].expectedResult == null || results[i].expectedResult === '' ? 'Not Available' : results[i].expectedResult,
                    area: results[i].area,
                    incidentAddress: results[i].incidentAddress == null || results[i].incidentAddress === '' ? 'Not Available' : results[i].incidentAddress,
                    // Other details
                    histories: histories
                });
            }
            
            console.log(complaints);
            res.status(200).json({
                complaints: complaints
            });

        }).catch(error=>{
            console.log('find complaint error', error);
            res.status(500).send();
        });
    }
    else if (user.role === 'complaint handler') {
        console.log('get complaint for complaint handler', user.emailAddress);

        complaintModel.aggregate([
            {
                $match: {
                    $or: [
                        {
                            created: {
                                $gte: startDate == null ? new Date('2023-01-01T00:00:00+08:00') : new Date(startDate + 'T00:00:00+08:00'),
                                $lte: endDate == null ? Date.now : new Date(endDate + 'T23:59:59+08:00')
                            },
                        },
                        {
                            title: searchWord == null ? '' : searchWord
                        }
                    ],
                    $or: [
                        {
                            complaintHandlerEmail: user.emailAddress
                        },
                        {
                            status: 'Received'
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'complainants',
                    localField: 'complainantEmail',
                    foreignField: 'emailAddress',
                    as: 'complainant'
                }
            }
        ]).then(results=>{
            console.log('find complaint', results);
        
            const complaints = [];
            for (var i = 0; i < results.length; i++) {
                const histories = [];
                
                for (var j = 0; j < results[i].histories.length; j++) {
                    histories.push({
                        id: results[i].histories[j]._id,
                        message: results[i].histories[j].message,
                        from: results[i].histories[j].from,
                        created: results[i].histories[j].created
                    });
                }

                complaints.push({
                    id: results[i]._id,
                    // Complaint details
                    title: results[i].title,
                    caseId: results[i]._id,
                    status: results[i].status,
                    created: results[i].created,
                    category: results[i].category,
                    description: results[i].description,
                    expectedResult: results[i].expectedResult == null || results[i].expectedResult === '' ? 'Not Available' : results[i].expectedResult,
                    area: results[i].area,
                    incidentAddress: results[i].incidentAddress == null || results[i].incidentAddress === '' ? 'Not Available' : results[i].incidentAddress,
                    // Complainant details
                    emailAddress: results[i].complainantEmail,
                    name: results[i].complainant[0].name,
                    IC_Number: results[i].complainant[0].IC_Number,
                    mobilePhoneNumber: results[i].complainant[0].mobilePhoneNumber,
                    homeAddress: results[i].complainant[0].homeAddress == null || results[i].complainant[0].homeAddress === '' ? 'Not Available' : results[i].complainant[0].homeAddress,
                    faxNumber: results[i].complainant[0].faxNumber == null || results[i].complainant[0].faxNumber === '' ? 'Not Available' : results[i].complainant[0].faxNumber,
                    // Other details
                    histories: histories,
                    complaintHandlerEmail: results[i].complaintHandlerEmail == null || results[i].complaintHandlerEmail === '' ? 'Not Available' : results[i].complaintHandlerEmail,
                    complaintHandlerName: results[i].complaintHandlerName == null || results[i].complaintHandlerEmail === '' ? 'Not Available' : results[i].complaintHandlerName
                });
            }

            console.log(complaints);
            res.status(200).json({
                complaints: complaints
            });
        
        }).catch(error=>{
            console.log('find complaint error', error);
            res.status(500).send();
        });
    }
    else if (user.role === 'administrator') {
        console.log('get complaint for administrator', user.emailAddress);

        complaintModel.aggregate([
            {
                $match: {
                    $or: [
                        {
                            created: {
                                $gte: startDate == null ? new Date('2023-01-01T00:00:00+08:00') : new Date(startDate + 'T00:00:00+08:00'),
                                $lte: endDate == null ? Date.now : new Date(endDate + 'T23:59:59+08:00')
                            }
                        },
                        {
                            title: searchWord == null ? '' : searchWord
                        },
                        {
                            complaintHandlerEmail: searchWord == null ? '' : searchWord
                        },
                        {
                            complaintHandlerName: searchWord == null ? '' : searchWord
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'complainants',
                    localField: 'complainantEmail',
                    foreignField: 'emailAddress',
                    as: 'complainant'
                }
            }
        ]).then(results=>{
            console.log('find complaint', results);
        
            const complaints = [];
            for (var i = 0; i < results.length; i++) {
                console.log(results[i], results[i].complainant, results[i].complainant[0].name);

                const histories = [];
                
                for (var j = 0; j < results[i].histories.length; j++) {
                    histories.push({
                        id: results[i].histories[j]._id,
                        message: results[i].histories[j].message,
                        from: results[i].histories[j].from,
                        created: results[i].histories[j].created
                    });
                }

                complaints.push({
                    id: results[i]._id,
                    // Complaint details
                    title: results[i].title,
                    caseId: results[i]._id,
                    status: results[i].status,
                    created: results[i].created,
                    category: results[i].category,
                    description: results[i].description,
                    expectedResult: results[i].expectedResult == null || results[i].expectedResult === '' ? 'Not Available' : results[i].expectedResult,
                    area: results[i].area,
                    incidentAddress: results[i].incidentAddress == null || results[i].incidentAddress === '' ? 'Not Available' : results[i].incidentAddress,
                    // Complainant details
                    emailAddress: results[i].complainantEmail,
                    name: results[i].complainant[0].name,
                    IC_Number: results[i].complainant[0].IC_Number,
                    mobilePhoneNumber: results[i].complainant[0].mobilePhoneNumber,
                    homeAddress: results[i].complainant[0].homeAddress == null || results[i].complainant[0].homeAddress === '' ? 'Not Available' : results[i].complainant[0].homeAddress,
                    faxNumber: results[i].complainant[0].faxNumber == null || results[i].complainant[0].faxNumber === '' ? 'Not Available' : results[i].complainant[0].faxNumber,
                    // Other details
                    histories: histories,
                    complaintHandlerEmail: results[i].complaintHandlerEmail == null || results[i].complaintHandlerEmail === '' ? 'Not Available' : results[i].complaintHandlerEmail,
                    complaintHandlerName: results[i].complaintHandlerName == null || results[i].complaintHandlerEmail === '' ? 'Not Available' : results[i].complaintHandlerName
                });
            }

            console.log(complaints);
            res.status(200).json({
                complaints: complaints
            });
        
        }).catch(error=>{
            console.log('find complaint error', error);
            res.status(500).send();
        });
    }
});

app.put('/changestatus', verifyToken, (req, res)=>{
    const user = req.user;
    const caseId = req.body.caseId;
    const newStatus = req.body.newStatus;
    console.log('change status', caseId, user, newStatus);

    if (!(user.role === 'complaint handler' || user.role === 'administrator')) {
        console.log('change status: not complaint handler or administrator');
        res.status(403).send();
        return;
    }

    complaintModel.findById(caseId).then(result=>{
        console.log('change status: check complaint handler email', result);

        if (result == null) {
            console.log('change status: complaint not found');
            res.status(400).json({
                message: 'Complaint not found'
            });
            return;
        }

        // Status
        if (result.status === 'solved') {
            console.log('change status: Already solved');
            res.status(400).json({
                message: 'Already solved'
            });
            return;
        }
        
        if (result.status === 'Received' && newStatus !== 'Progressing' || result.status === 'Progressing' && newStatus !== 'Solved') {
            console.log('change status: Status not allowed');
            res.status(400).json({
                message: 'Status not allowed'
            });
            return;
        }

        // Complaint handler    
        if (user.role === 'complaint handler' && result.complaintHandlerEmail != null && user.emailAddress !== result.complaintHandlerEmail) {
            console.log('change status: complaint handler email not match');
            res.status(400).json({
                message: 'Complaint handler email not match'
            });
            return;
        }

        const promises = [];

        if (result.complaintHandlerEmail == null) {
            promises.push(new Promise((resolve, reject)=>{
                complaintModel.findByIdAndUpdate(caseId, {
                    complaintHandlerEmail: user.emailAddress,
                    complaintHandlerName: user.name,
                    $push: {
                        histories: {
                            message: `${user.name} (${user.emailAddress}) is the complaint handler of this case.`,
                            from: 'System',
                            isInternal: true 
                        }
                    }
                }).then(response=>{
                    console.log('change status: assign complaint handler', response);
                    resolve();
                }).catch(error=>{
                    console.log('change status: assign complaint handler', error);
                    resolve();
                });
            }));
        }

        promises.push(new Promise((resolve, reject)=>{
            complaintModel.findByIdAndUpdate(caseId, {
                status: newStatus,
                $push: {
                    histories: {
                        message: `Status is changed to "${newStatus}".`,
                        from: 'System'
                    }
                }
            }).then(response=>{
                console.log('change status', response);
                resolve();
            }).catch(error=>{
                console.log('change status', error);
                resolve();
            });
        }));
        
        Promise.all(promises).then(response=>{
            console.log('change status: all updated', response);

            const mailOptions = {
                from: process.env.MAILER_USER,
                to: result.complainantEmail,
                subject: `Complaint case notification (${result._id})`,
                html: `
                    <p>Hi ${result.complainantName},</p>
                    <p/>
                    <p>The following is the recent update related to your complaint case of id ${result._id}.</p>
                    <p><strong>New status: ${newStatus}</strong></p>
                    <p/>
                    <p>Regards,</p>
                    <p>City Complaint System</p>
                `
            }

            transporter.sendMail(mailOptions, (error, info)=>{
                if (error != null) {
                    console.log('send notification email error', error);
                } else {
                    console.log('send notification email', info.response);  
                }

                res.status(200).json({
                    message: 'Status changed'
                });
            });

        }).catch(error=>{
            console.log('change status: update', error);
            res.status(500).send();
        });

    }).catch(error=>{
        console.log('change status: check complaint handler email', error);
        res.status(500).send();
    });
});

app.post('/addmessage', verifyToken, (req, res)=>{
    const user = req.user;
    const caseId = req.body.caseId;
    const message = req.body.message;
    console.log('add message', caseId, user, message);

    complaintModel.findById(caseId).then(result=>{
        console.log('add message: check complaint exist', result);

        if (result == null) {
            console.log('add message: complaint not found');
            res.status(400).json({
                message: 'Complaint not found'
            });
            return;
        }

        if (result.status === 'solved') {
            console.log('add message: Already solved');
            res.status(400).json({
                message: 'Already solved'
            });
            return;
        }

        if (user.role === 'complaint handler' && result.complaintHandlerEmail != null && user.emailAddress !== result.complaintHandlerEmail) {
            console.log('add message: complaint handler email not match');
            res.status(400).json({
                message: 'Complaint handler email not match'
            });
            return;
        }

        if (user.role === 'complainant' && user.emailAddress !== result.complainantEmail) {
            console.log('add message: complainant email not match');
            res.status(400).json({
                message: 'Complainant email not match'
            });
            return;
        }

        const promises = [];

        if ((user.role === 'complaint handler' || user.role === 'administrator') && result.complaintHandlerEmail == null) {
            promises.push(new Promise((resolve, reject)=>{
                complaintModel.findByIdAndUpdate(caseId, {
                    complaintHandlerEmail: user.emailAddress,
                    complaintHandlerName: user.name,
                    $push: {
                        histories: {
                            message: `${user.name} (${user.emailAddress}) is the complaint handler of this case.`,
                            from: 'System',
                            isInternal: true 
                        }
                    }
                }).then(response=>{
                    console.log('add message: assign complaint handler', response);
                    resolve();
                }).catch(error=>{
                    console.log('add message: assign complaint handler', error);
                    resolve();
                });
            }));
        }

        promises.push(new Promise((resolve, reject)=>{
            complaintModel.findByIdAndUpdate(caseId, {
                $push: {
                    histories: {
                        message: message,
                        from: (user.role === 'complainant' ? 'Complainant Side' : 'Complaint Handling Side')
                    }
                }
            }).then(response=>{
                console.log('add message', response);
                resolve();
            }).catch(error=>{
                console.log('add message', error);
                resolve();
            });
        }));
        
        
        Promise.all(promises).then(response=>{
            console.log('add message: all updated', response);

            if (user.role === 'complainant') {
                res.status(201).json({
                    message: 'Added'
                });
                return;
            }

            const mailOptions = {
                from: process.env.MAILER_USER,
                to: result.complainantEmail,
                subject: `Complaint case notification (${result._id})`,
                html: `
                    <p>Hi ${result.complainantName},</p>
                    <p/>
                    <p>The following is the recent update related to your complaint case of id ${result._id}.</p>
                    <p><strong>New message: ${message}</strong></p>
                    <p/>
                    <p>Regards,</p>
                    <p>City Complaint System</p>
                `
            }

            transporter.sendMail(mailOptions, (error, info)=>{
                if (error != null) {
                    console.log('send notification email error', error);
                } else {
                    console.log('send notification email', info.response);  
                }

                res.status(201).json({
                    message: 'Added'
                });
            });

        }).catch(error=>{
            console.log('add message: update', error);
            res.status(500).send();
        });

    }).catch(error=>{
        console.log('add message: check complaint exist', error);
        res.status(500).send();
    });
});

app.put('/assigncomplainthandler', verifyToken, (req, res)=>{
    const user = req.user;
    const caseId = req.body.caseId;
    const complaintHandlerEmail = req.body.complaintHandlerEmail;
    console.log('assign complaint handler', caseId, user, complaintHandlerEmail);

    if (user.role !== 'administrator') {
        console.log('assign complaint handler: not administrator');
        res.status(403).send();
        return;
    }

    complaintModel.findById(caseId).then(result=>{
        console.log('assign complaint handler: check complaint exist', result);

        if (result == null) {
            console.log('assign complaint handler: complaint not found');
            res.status(400).json({
                message: 'Complaint not found'
            });
            return;
        }

        if (result.status === 'solved') {
            console.log('assign complaint handler: Already solved');
            res.status(400).json({
                message: 'Already solved'
            });
            return;
        }

        if (complaintHandlerEmail === result.complaintHandlerEmail) {
            console.log('assign complaint handler: same complaint handler');
            res.status(400).json({
                message: 'Same complaint handler'
            });
            return;
        }

        complaintHandlerModel.findOne({emailAddress: complaintHandlerEmail}).then(response=>{
            console.log('assign complaint handler: find complaint handler exist', response);

            if (response == null) {
                console.log('assign complaint handler: complaint handler not found');
                res.status(400).json({
                    message: 'Complaint handler not found'
                });
                return;
            }

            complaintModel.findByIdAndUpdate(caseId, {
                complaintHandlerEmail: complaintHandlerEmail,
                complaintHandlerName: response.name,
                $push: {
                    histories: {
                        message: `${response.name}(${complaintHandlerEmail}) is assigned as the complaint handler of this case.`,
                        from: 'System',
                        isInternal: true
                    }
                }
            }).then(result=>{
                console.log('assign complaint handler: update success', result);
    
                res.status(200).json({
                    message: 'Updated'
                });
    
            }).catch(error=>{
                console.log('assign complaint handler: update', error);
                res.status(500).send();
            });
        }).catch(error=>{
            console.log('assign complaint handler: find complaint handler exist', error);
            res.status(500).send();
        });
    }).catch(error=>{
        console.log('add message: check complaint exist', error);
        res.status(500).send();
    });
});

app.get('/allcomplainthandlers', verifyToken, (req, res)=>{
    const user = req.user;
    console.log('get complaint handlers', user);

    if (user.role !== 'administrator') {
        console.log('get complaint handler: Not administrator');
        res.status(403).send();
        return;
    }

    complaintHandlerModel.find({role: 'complaint handler'}).then(results=>{
        console.log('complaint handlers: ' + results);

        const complaintHandlers = [];
        for (var i=0; i<results.length; i++){
            complaintHandlers.push({
                id: results[i]._id,
                name: results[i].name,
                emailAddress: results[i].emailAddress,
                created: results[i].created
            });
        }

        res.status(200).json({
            complaintHandlers: complaintHandlers
        });
    }).catch(error=>{
        console.log('complaint handlers', error);
        res.status(500).send();
    });
});

app.post('/addcomplainthandler', verifyToken, (req, res)=>{
    const user = req.user;
    const emailAddress = req.body.emailAddress;
    const name = req. body.name;
    console.log('add complaint handlers', emailAddress, name, user);

    if (user.role !== 'administrator') {
        console.log('add complaint handler: Not administrator');
        res.status(403).send();
        return;
    }

    try {
        if (emailAddress == null)
            throw "No email address";
        if (name == null)
            throw "No name";
    }
    catch(error) {
        console.log('add complaint handler', error);
        res.status(400).json({
            message: error
        });
        return;
    }

    complaintHandlerModel.findOne({emailAddress: emailAddress}).then(result=>{
        console.log('add complaint handler find exist', result);
        
        if (result != null) {
            console.log('add complaint handler find exist: Exist');
            res.status(400).json({
                message: 'Email address already exists'
            });
            return;
        }
        
        complainantModel.findOne({emailAddress: emailAddress}).then(result=>{
            console.log('add complaint handler find exist complainant', result);

            if (result != null) {
                console.log('add complaint handler find exist complainant: Exist');
                res.status(400).json({
                    message: 'Email address already exists'
                });
                return;
            }

            const mailOptions = {
                from: process.env.MAILER_USER,
                to: emailAddress,
                subject: 'Complaint Handler Registration',
                html: `
                    <p>Hi ${name.trim()}, </p>
                    <p>To complete the registration as complaint handler, please click this <a href="http://localhost:${process.env.REACT_PORT}/setpassword">link</a> to set your password.</p>
                    <p/>
                    <p>Regards,</p>
                    <p>City Complaint System</p>
                `
            }

            transporter.sendMail(mailOptions, function (error, info) {
                if (error != null) {
                    console.log('send email error', error);
                    res.status(500).send();
                    return;
                }
                console.log('send email', info.response);

                const complaintHandler = new complaintHandlerModel({
                    name: name,
                    emailAddress: emailAddress
                });
    
                complaintHandler.save().then(result=>{
                    console.log('add complaint handler save', result);
                    res.status(201).json({
                        message: 'Added',
                        complaintHandler: {
                            id: result._id,
                            name: result.name,
                            emailAddress: result.emailAddress,
                            created: result.created
                        }
                    });
                }).catch(error=>{
                    console.log('add complaint handler save error', error);
                    res.status(500).send();
                });
            });
        }).catch(error=>{
            console.log('add complaint handler find exist complainant error', error);
            res.status(500).send();
        });
    }).catch(error=>{
        console.log('add complaint handler find exist error', error);
        res.status(500).send();
    });
});

app.delete('/deletecomplainthandler', verifyToken, (req, res)=>{
    const user = req.user;
    const emailAddress = req.query.emailAddress;
    console.log('delete complaint handlers', emailAddress, user);

    if (user.role !== 'administrator') {
        console.log('delete complaint handler: Not administrator');
        res.status(403).send();
        return;
    }

    if (emailAddress == null) {
        console.log('delete complaint handler: No email address');
        res.status(400).json({
            message: 'No email address'
        });
        return;
    }

    complaintModel.findOne({complainantEmail: emailAddress, status: 'Progressing'}).then(result=>{
        console.log('find not settled complaint', result);
        
        if (result != null) {
            console.log('find not settled complaint: Exist');
            res.status(400).json({
                message: 'This complaint handler still have complaint which is not settled (status: progressing)'
            });
            return;
        }

        complaintHandlerModel.deleteMany({emailAddress: emailAddress}).then(result=>{
            console.log('delete complaint handler', result);
            res.status(204).json({
                message: 'Deleted'
            });
        }).catch(error=>{
            console.log('delete complaint handler error', error);
            res.status(500).send();
        });
    }).catch(error=>{
        console.log('find not settled complaint error', error);
        res.status(500).send();
    });
});

app.get('/complaintcount', verifyToken, (req, res) => {
    const user = req.user;
    const byCategory = req.query.bycategory;
    const byArea = req.query.byarea;
    const byStatus = req.query.bystatus;
    var startDate = req.query.startdate;
    var endDate = req.query.enddate;
    console.log('get complaint count', user, byCategory, byArea, byStatus, startDate, endDate);

    if (user.role !== 'administrator') {
        console.log('get complaint by group: Not administrator');
        res.status(403).send();
        return;
    }

    try {
        const regExp_Date = /^2[0-9]{3}\-[0-1][0-9]\-[0-3][0-9]$/;
        
        if (startDate != null) {
            startDate = startDate.trim();
            if (regExp_Date.test(startDate) === false) 
                throw 'Not a valid start date';
        }

        if (endDate != null) {
            endDate = endDate.trim();
            if (regExp_Date.test(endDate) === false)
                throw 'Not a valid end date';
        }
    }
    catch(error) {
        console.log('get complaint count:', error);
        res.status(400).json({
            message: error
        });
        return;
    }

    complaintModel.aggregate(
        [
            {
                $match: {
                    created: {
                        $gte: startDate == null ? new Date('2023-01-01T00:00:00+08:00') : new Date(startDate + 'T00:00:00+08:00'),     // Note: 2023-01-01 is a date which this system was not yet be used
                        $lte: endDate == null ? Date.now : new Date(endDate + 'T23:59:59+08:00')
                    }
                }
            },
            {
                $group: {
                    _id: {
                        category: byCategory != null && byCategory === '1' ? '$category' : null,
                        area: byArea != null && byArea === '1' ? '$area' : null,
                        status: byStatus != null && byStatus === '1' ? '$status' : null
                    },
                    count: {
                        $sum: 1
                    }
                }
            }
        ]
    ).then(result=>{
        console.log('get complaint count', result);
        res.status(200).json({
            counts: result
        });
    }).catch(error=>{
        console.log('get complaint count', error);
        res.status(500).send();
    });
});

// The following block of code is used for creating new administrator
/*
const md5 = require('md5');
const crypto = require('crypto');

const password = 'My$Password123?';
const hashedPassword = md5(password);
const salt = crypto.randomBytes(16).toString('base64');

crypto.pbkdf2(hashedPassword, salt, 100, 256, 'sha-256', (err, derivedKey)=>{
    if (err != null) {
        console.log(err);
    }
    else {
        const securedPassword = derivedKey.toString('base64');
        const administrator = new complaintHandlerModel({
            emailAddress: 'cks123@mail.com',
            name: 'cks',
            password: securedPassword,
            salt: salt,
            role: 'administrator'
        });
        administrator.save().then(response=>{
            console.log('saved', response);
        }).catch(error=>{
            console.log('not saved', error);
        });
    }
});
*/

app.listen(process.env.PORT, ()=>
{
    console.log('Listening from port', process.env.PORT);
});
