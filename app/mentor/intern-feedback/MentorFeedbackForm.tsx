'use client'
import { useState } from 'react'

interface Student {
  id: string
  full_name: string
  university: string
  wing: string
}

interface Internship {
  id: string
  start_date: string
  end_date: string
  student: Student
  feedback?: {
    mentor_rating: number | null
    mentor_comments: string | null
  }
}

interface MentorFeedbackFormProps {
  internships: Internship[]
}

export default function MentorFeedbackForm({ internships }: MentorFeedbackFormProps) {
  const [selectedId, setSelectedId] = useState<string>(internships[0]?.id || '')
  const currentInternship = internships.find(i => i.id === selectedId)

  const [rating, setRating] = useState<number>(currentInternship?.feedback?.mentor_rating || 0)
  const [comments, setComments] = useState<string>(currentInternship?.feedback?.mentor_comments || '')
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  // Reset form when selected internship changes
  function handleSelect(id: string) {
    setSelectedId(id)
    const match = internships.find(i => i.id === id)
    setRating(match?.feedback?.mentor_rating || 0)
    setComments(match?.feedback?.mentor_comments || '')
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    if (rating === 0) {
      setError('Please select a rating of 1 to 5 stars.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internship_id: selectedId,
          rating,
          comments
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback')
      
      setSuccess('Feedback submitted successfully for ' + currentInternship?.student.full_name)
      // Update local copy so it remains if they switch back
      if (currentInternship) {
        if (!currentInternship.feedback) currentInternship.feedback = { mentor_rating: null, mentor_comments: null }
        currentInternship.feedback.mentor_rating = rating
        currentInternship.feedback.mentor_comments = comments
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (internships.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center text-gray-500 text-sm">
        No active students assigned to you at the moment.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Sidebar List of Students */}
      <div className="md:col-span-1 bg-white rounded-2xl border border-gray-100 p-4 space-y-2 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-2 mb-2">My Interns</h3>
        <div className="space-y-1">
          {internships.map((internship) => {
            const hasSubmitted = !!internship.feedback?.mentor_rating
            return (
              <button
                key={internship.id}
                onClick={() => handleSelect(internship.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  selectedId === internship.id
                    ? 'bg-green-50 text-green-700 font-semibold border-l-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate block font-medium">{internship.student.full_name}</span>
                  {hasSubmitted && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                      ✓ Rated
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 block mt-0.5">{internship.student.university}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Feedback Form */}
      <div className="md:col-span-2 space-y-6">
        {currentInternship && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Intern Performance Evaluation</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <p><strong>Intern Name:</strong> {currentInternship.student.full_name}</p>
                <p><strong>Department:</strong> {currentInternship.student.wing}</p>
                <p><strong>College/Uni:</strong> {currentInternship.student.university}</p>
                <p><strong>Duration:</strong> {currentInternship.start_date} to {currentInternship.end_date}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Mentor Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-3xl focus:outline-none transition-colors"
                  >
                    <span
                      className={
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 scale-110'
                          : 'text-gray-200'
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Comments, Strengths & areas for Improvement</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                placeholder="Detail the candidate's performance, work ethic, punctuality, technical project completion..."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-600 text-xs p-3 rounded-xl">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#166534] hover:bg-[#155e2f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Save Evaluation'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
