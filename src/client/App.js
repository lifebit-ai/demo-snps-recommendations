import React, { Component } from 'react'
import { Table, Button, Tag } from 'antd'
import { withCookies, Cookies } from 'react-cookie'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'antd/dist/antd.css'
import './app.css'

const axios = require('axios')

const COOKIE_NAME = 'jobId'

class App extends Component {

  constructor(props) {
    super(props)
    const { cookies } = props
    this.state = {
      file: null,
      submitting: false,
      jobId: cookies.get(COOKIE_NAME)
    }
    this.submitFile = this.submitFile.bind(this)
    this.render = this.render.bind(this)
  }

  submitFile = event => {
    const self = this
    self.setState({ submitting: true })
    event.preventDefault()
    console.log('event', event.target.elements)
    const formData = new FormData()
    formData.append('file', self.state.file)
    axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => {
      console.log('uploaded', response)
      const { jobId } = response.data
      if (jobId) self.setState({ submitting: false, jobId })
      else throw new Error('not jobid')
    }).catch(error => {
      console.error(error)
      self.setState({ submitting: false })
    })
  }

  restart = () => {
    this.props.cookies.remove(COOKIE_NAME)
    this.setState({ jobId: null, status: null })
  }

  render() {
    const { file, submitting, jobId, status } = this.state

    let content = <FileUploader parent={this} file={file} />
    if (jobId) {
      if (status === 'completed') {
        content = [<Results parent={this} />, <Restart parent={this} />]
      } else if (status === 'failed') {
        content = [<div>Sorry the computation of your file failed</div>, <Restart parent={this} />]
      } else {
        content = [<JobStatus parent={this} />, <Restart parent={this} />]
      }
    }
    return (
      <div className="container">
        {submitting ? <Overlay> <Loader /> </Overlay> : null}
        <div className="row">
          <div className="col-12 text-center">
            <h1 className="mt-5">LifeBit demo app</h1>
            {content}

          </div>
        </div>
      </div>
    )
  }
}
export default withCookies(App)


const Overlay = ({ children }) => <div className="overlay">{children}</div>

const Loader = () => <div className="loader" />

const FileUploader = ({ parent, file }) => (
  <form onSubmit={parent.submitFile} className="form-upload">
    <div className="form-label-group">
      <input className="form-control" onChange={e => parent.setState({ file: (e.target.files && e.target.files[0] ? e.target.files[0] : null) })} type="file" name="file" />
    </div>
    <button className="btn btn-lg btn-primary btn-block" disabled={file ? false : 'disabled'} type="submit" value="Submit">Send</button>
  </form>
)

const Restart = ({ parent }) => <Button type="primary" size="large" onClick={parent.restart}>Restart</Button>

class JobStatus extends Component { // eslint-disable-line
  constructor(props) {
    super(props)
    this.check = this.check.bind(this)
    this.state = {}
  }

  componentDidMount() {
    this.timerID = setInterval(this.check, 5000)
  }

  componentWillUnmount() {
    clearInterval(this.timerID)
  }

  check() {
    axios.get('/api/job').then(res => {
      const { status } = res.data.job
      if (status === 'completed' ||  status === 'failed') {
        clearInterval(this.timerID)
        this.props.parent.setState({ status })
      } else {
        this.setState({ status })
      }
    })
  }

  render() {
    const { status } = this.state
    return (
      <div>
        Computing your results. Please wait ... { status ? 'Your job is ' : null } { status ? <Tag>{status}</Tag> : null }
      </div>
    )
  }
}

class Results extends Component { // eslint-disable-line
  constructor(props) {
    super(props)
    this.getResults = this.getResults.bind(this)
    this.state = { fetching: true }
    this.getResults()
  }

  getResults() {
    axios.get('/api/job/results').then(res => {
      const {
        success,
        contents,
      } = res.data
      if (success) {
        this.setState({ contents })
      } else {
        this.setState({ error: true })
      }
    })
      .catch(() => this.setState({ error: true }))
      .finally(() => this.setState({ fetching: false }))
  }

  render() {
    const {
      contents,
      fetching,
      error,
    } = this.state

    if (error) {
      return (
        <div>
          Sorry something went wrong we cannot fetch your results
        </div>
      )
    }

    if (contents) {
      const tables = contents.map(c => {
        const headers = Object.keys(c[0])
        const columns = headers.map(h => ({
          title: h,
          key: h,
          dataIndex: h,
          width: 200
        }))
        return <Table columns={columns} dataSource={c} pagination={false} scroll={{ x: true }} />
      })
      return (
        <div className="demoApp">
          <h3>Recommendations</h3>
          {tables[1]}
          <h3>Raw Data</h3>
          {tables[0]}
        </div>
      )
    }

    if (fetching) {
      return (
        <div>
          Fetching your results ...
        </div>
      )
    }
  }
}
