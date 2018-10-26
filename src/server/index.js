// https://blog.stvmlbrn.com/2017/04/07/submitting-form-data-with-react.html

// https://www.digitalocean.com/community/tutorials/how-to-upload-a-file-to-object-storage-with-node-js
// https://medium.com/ecmastack/uploading-files-with-react-js-and-node-js-e7e6b707f4ef
// https://github.com/abachuk/uploading-files-react-node
const aws          = require('aws-sdk')
const express      = require('express')
const multer       = require('multer')
const multerS3     = require('multer-s3')
const config       = require('config')
const cookieParser = require('cookie-parser')
const csv          = require('fast-csv')
const LifeBit      = require('./lifebit')


const app = express()

app.use(cookieParser())
app.use(express.static('dist'))

const lifebit = new LifeBit(config.get('lifebit.apikey'))

const s3 = new aws.S3({
  accessKeyId: config.get('aws.key'),
  secretAccessKey: config.get('aws.secret'),
  region: config.get('aws.region'),
})

// Change bucket property to your Space name
const upload = multer({
  storage: multerS3({
    s3,
    bucket: config.get('aws.bucket'),
    // acl: 'public-read',
    key: (request, file, cb) => {
      console.log(file)
      cb(null, file.originalname)
    }
  })
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('File uploaded successfully.')
    console.log(req.file)
    const { file } = req
    const job = await lifebit.startSnpsJob(file)
    console.log(job)
    // res.cookie('jobId', '5bc87c9c55424c2b6c303b3c', { maxAge: 900000 })
    if (job && job._id) res.cookie('jobId', job._id, { maxAge: 3600000 })
    // res.clearCookie('name')
    // res.status(200).json({ success: true, job })
    res.status(200).json({ success: true, file, jobId: job._id })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.get('/api/job', async (req, res) => {
  try {
    console.log(req.cookies)
    const { jobId } = req.cookies
    const job = jobId ? await lifebit.getJob(jobId) : null
    console.log(job)
    res.json({ job })
  } catch (e) {
    console.log(e)
  }
})

app.get('/api/job/results', async (req, res) => {
  try {
    console.log(req.cookies)
    const { jobId } = req.cookies
    const job = jobId ? await lifebit.getJob(jobId) : null
    const { results } = job
    // console.log('results', results)
    if (results && results.s3Bucket && results.s3Prefix) {
      const s3params =  {
        Bucket: results.s3Bucket,
        Prefix: results.s3Prefix
      }
      console.log('s3params', s3params)
      const s3Data = await new Promise(
        (resolve, reject) => s3.listObjectsV2(s3params,
          (err, data)  => (err ? reject(err) : resolve(data)))
      )
      // console.log('s3Data', s3Data)
      const rawDataFile = s3Data ? s3Data.Contents.find(c => c.Key.match(/.*raw_data\.csv$/)) : null
      const recommendationFile = s3Data ? s3Data.Contents.find(c => c.Key.match(/.*recommendations\.csv$/)) : null
      // console.log('rawDataFile', rawDataFile, recommendationFile)
      if (rawDataFile && recommendationFile) {
        const contentPromises = [rawDataFile, recommendationFile].map(file => {
          const txtContentParams = {
            Bucket: results.s3Bucket,
            Key: file.Key
          }
          return new Promise(
            (resolve, reject) => s3.getObject(txtContentParams,
              (err, data)  => (err ? reject(err) : resolve(data.Body.toString())))
          )
        })
        const tempContents = await Promise.all(contentPromises)
        const promises2 = tempContents.map(c => new Promise(resolve => {
          const result = []
          csv.fromString(c, { headers: true })
            .on('data', data => {
              result.push(data)
            })
            .on('end', () => resolve(result))
        }))
        const contents = await Promise.all(promises2)
        // console.log('contents', contents)
        res.json({ success: true, contents })
        return
      }
    }
    res.json({ success: false })
  } catch (e) {
    console.log(e)
    res.json({ success: false })
  }
})

app.listen(process.env.PORT || config.get('app.port'), () => console.log(`Listening on port ${process.env.PORT || config.get('app.port')}!`))
